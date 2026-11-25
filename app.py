#!/usr/bin/env python3
"""Ripe — Pomodoro timer that ripens as you work.
   Native Linux desktop app: Python + GTK3 + WebKit2GTK.
   Run: python3 app.py
"""
import os, sys, json, cairo
# Force X11 backend so begin_move_drag() and move() work on Wayland via XWayland
os.environ['GDK_BACKEND'] = 'x11'
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
gi.require_version('Gdk', '3.0')
from gi.repository import Gtk, WebKit2, Gdk, GLib

HERE      = os.path.dirname(os.path.abspath(__file__))
INDEX_URI = f'file://{os.path.join(HERE, "index.html")}'
MINI_URI  = f'file://{os.path.join(HERE, "mini.html")}'
FULL_W, FULL_H   = 480, 720
WIDGET_W, WIDGET_H = 170, 215
MARGIN = 20   # px gap from screen edge in widget mode

# ── Bridge JS injected into the MAIN app page ──────────────────────────────
BRIDGE_JS = """
(function(){
  window.ripe = {
    _post: (obj) => {
      try { window.webkit.messageHandlers.ripe.postMessage(JSON.stringify(obj)); }
      catch(e) { console.error('[ripe] IPC error', e); }
    },
    miniMode: () => window.ripe._post({cmd:'miniMode'}),
    minimize: () => window.ripe._post({cmd:'minimize'}),
    close:    () => window.ripe._post({cmd:'close'}),
    expand:   () => window.ripe._post({cmd:'expand'}),
  };

  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.bar');
    if (!bar) return;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, a')) return;
      window.ripe._post({cmd:'startDrag', x:e.screenX, y:e.screenY, t:Math.round(e.timeStamp)});
    });
  });
})();
"""

# ── Bridge JS injected into the MINI widget page ───────────────────────────
MINI_BRIDGE_JS = """
(function(){
  window.ripe = {
    _post: (obj) => {
      try { window.webkit.messageHandlers.ripeMini.postMessage(JSON.stringify(obj)); }
      catch(e) { console.error('[mini] IPC error', e); }
    },
    expand:      () => window.ripe._post({cmd:'expand'}),
    close:       () => window.ripe._post({cmd:'close'}),
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      window.ripe._post({cmd:'drag', x:e.screenX, y:e.screenY, t:Math.round(e.timeStamp)});
    });
  });
})();
"""


def _make_webview(bridge_js, handler_name, on_msg_cb):
    """Create a WebKit2 WebView with IPC bridge."""
    wv = WebKit2.WebView()
    s  = wv.get_settings()
    s.set_enable_javascript(True)
    s.set_allow_universal_access_from_file_urls(True)
    s.set_allow_file_access_from_file_urls(True)

    ucm = wv.get_user_content_manager()
    ucm.add_script(WebKit2.UserScript(
        bridge_js,
        WebKit2.UserContentInjectedFrames.TOP_FRAME,
        WebKit2.UserScriptInjectionTime.START,
        None, None,
    ))
    ucm.register_script_message_handler(handler_name)
    ucm.connect(f'script-message-received::{handler_name}', on_msg_cb)
    return wv


class WidgetWindow(Gtk.Window):
    """Small always-on-top floating tomato widget."""

    def __init__(self, main_win):
        super().__init__(title='Ripe Widget')
        self.main_win = main_win
        self._loaded  = False

        self.set_decorated(False)
        self.set_resizable(False)
        self.set_default_size(WIDGET_W, WIDGET_H)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        # Connect destroy to prevent it from quitting the app
        self.connect('delete-event', lambda *_: True)

        # RGBA transparent background (requires compositing to be active)
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            self.set_visual(visual)
        self.set_app_paintable(True)
        self.connect('draw', self._on_draw)  # clear to transparent each frame

        # Transparent WebView
        transparent = Gdk.RGBA(0, 0, 0, 0)
        self.wv = _make_webview(MINI_BRIDGE_JS, 'ripeMini', self._on_msg)
        self.wv.set_background_color(transparent)
        self.add(self.wv)

        # Load the mini page (stays loaded but window stays hidden until needed)
        self.wv.load_uri(MINI_URI)
        self.wv.connect('load-changed', self._on_load)

    def _on_draw(self, widget, cr):
        """Clear GTK window to fully transparent so the HTML card floats."""
        cr.set_source_rgba(0, 0, 0, 0)
        cr.set_operator(cairo.OPERATOR_CLEAR)
        cr.paint()
        return False

    def _on_load(self, _wv, event):
        if event == WebKit2.LoadEvent.FINISHED:
            self._loaded = True

    def _js(self, code):
        self.wv.run_javascript(code, None, None, None)

    def _on_msg(self, _ucm, result):
        try:
            msg = json.loads(result.get_js_value().to_string())
        except Exception as e:
            print(f'[mini] bad msg: {e}', file=sys.stderr)
            return
        cmd = msg.get('cmd', '')

        if cmd == 'drag':
            self.begin_move_drag(1, int(msg.get('x', 0)), int(msg.get('y', 0)),
                                 int(msg.get('t', 0)))
        elif cmd == 'expand':
            state = msg.get('state', {})
            self.main_win._restore_from_widget(state)
        elif cmd == 'close':
            Gtk.main_quit()

    def show_widget(self, state):
        """Position in bottom-right corner and show with given timer state."""
        area = self.main_win._screen_workarea()
        x = area.x + area.width  - WIDGET_W - MARGIN
        y = area.y + area.height - WIDGET_H - MARGIN
        self.move(x, y)

        rem   = state.get('remaining', 1500)
        rip   = state.get('ripeness', 0.0)
        run   = 'true' if state.get('running', False) else 'false'
        total = state.get('total', rem)

        def _init():
            self._js(f'if(window.initWidget) initWidget({rem},{rip},{run},{total});')
            return False

        self.show_all()
        self.set_keep_above(True)
        # Give the page a moment to be ready if it just loaded
        GLib.timeout_add(200 if not self._loaded else 50, _init)

    def hide_widget(self):
        self.hide()
        self.set_keep_above(False)


class RipeWindow(Gtk.Window):
    """Main 480×720 app window."""

    def __init__(self):
        super().__init__(title='Ripe')
        self.is_widget = False

        self.set_default_size(FULL_W, FULL_H)
        self.set_decorated(False)
        self.set_resizable(True)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.connect('destroy', Gtk.main_quit)

        bg = Gdk.RGBA()
        bg.parse('#9EC1CF')

        self.wv = _make_webview(BRIDGE_JS, 'ripe', self._on_msg)
        self.wv.set_background_color(bg)
        self.add(self.wv)
        self.show_all()
        self.wv.load_uri(INDEX_URI)

        # Create the widget window upfront (keeps mini.html preloaded)
        self.widget_win = WidgetWindow(self)

    # ── IPC from main page ────────────────────────────────────────────────
    def _on_msg(self, _ucm, result):
        try:
            msg = json.loads(result.get_js_value().to_string())
        except Exception as e:
            print(f'[ripe] bad msg: {e}', file=sys.stderr)
            return
        cmd = msg.get('cmd', '')

        if cmd == 'miniMode':
            state = msg.get('state', {})
            self._enter_widget(state)
        elif cmd == 'minimize':
            self.iconify()
        elif cmd == 'expand':
            self._restore_from_widget({})
        elif cmd == 'close':
            Gtk.main_quit()
        elif cmd == 'startDrag':
            self.begin_move_drag(1, int(msg.get('x', 0)), int(msg.get('y', 0)),
                                 int(msg.get('t', 0)))

    def _js(self, code):
        self.wv.run_javascript(code, None, None, None)

    def _screen_workarea(self):
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        return monitor.get_workarea()

    # ── widget ↔ full transitions ─────────────────────────────────────────
    def _enter_widget(self, state):
        self.is_widget = True
        # Pause the main timer so it doesn't drift while hidden
        self._js("if(typeof pause==='function' && state && state.running) pause();")
        self.widget_win.show_widget(state)
        self.hide()

    def _restore_from_widget(self, state):
        self.is_widget = False
        self.widget_win.hide_widget()
        self.show()
        self.present()
        self.set_position(Gtk.WindowPosition.CENTER)
        # Sync timer state back into the main app if provided
        if state:
            rem  = state.get('remaining', 0)
            rip  = state.get('ripeness', 0)
            run  = 'true' if state.get('running', False) else 'false'
            self._js(
                f'if(typeof restoreWidgetState==="function") '
                f'restoreWidgetState({rem},{rip},{run});'
            )


if __name__ == '__main__':
    os.environ.setdefault('GDK_SCALE', '1')
    win = RipeWindow()
    Gtk.main()
