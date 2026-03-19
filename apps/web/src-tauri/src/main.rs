#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, WindowBuilder, WindowUrl,
};

fn make_tray() -> SystemTray {
    let menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("focus", "Focus Timer"))
        .add_item(CustomMenuItem::new("quit", "Quit"));
    SystemTray::new().with_menu(menu)
}

fn toggle_focus_popup(app: &tauri::AppHandle) {
    const LABEL: &str = "focus-popup";

    if let Some(win) = app.get_window(LABEL) {
        // Toggle: if visible, hide; if hidden, show & focus
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
        return;
    }

    // First time: create the popup window
    let _win = WindowBuilder::new(app, LABEL, WindowUrl::App("/os/focus".into()))
        .title("Focus Timer")
        .inner_size(320.0, 360.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .build();
}

fn main() {
    // On Windows, hint WebView2 to use hardware-accelerated rendering and
    // skip the smart-screen / first-run setup that can delay initial load.
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --disable-features=msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
        );
    }

    tauri::Builder::default()
        .system_tray(make_tray())
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                toggle_focus_popup(app);
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "focus" => {
                    toggle_focus_popup(app);
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
