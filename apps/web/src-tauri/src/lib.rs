#[cfg(desktop)]
mod desktop {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        webview::WebviewWindowBuilder,
        Manager, WebviewUrl,
    };

    pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let focus_item = MenuItem::with_id(app, "focus", "Focus Timer", true, None::<&str>)?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&focus_item, &quit_item])?;

        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .icon_as_template(true)
            .menu(&menu)
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_focus_popup(tray.app_handle());
                }
            })
            .on_menu_event(|app, event| match event.id().as_ref() {
                "focus" => {
                    toggle_focus_popup(app);
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            })
            .build(app)?;

        Ok(())
    }

    fn toggle_focus_popup(app: &tauri::AppHandle) {
        const LABEL: &str = "focus-popup";

        if let Some(win) = app.get_webview_window(LABEL) {
            if win.is_visible().unwrap_or(false) {
                let _ = win.hide();
            } else {
                let _ = win.show();
                let _ = win.set_focus();
            }
            return;
        }

        let _win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("/os/focus".into()))
            .title("Focus Timer")
            .inner_size(320.0, 360.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .center()
            .build();
    }
}

fn run_app() {
    // On Windows, hint WebView2 to use hardware-accelerated rendering
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --disable-features=msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
        );
    }

    let mut builder = tauri::Builder::default();

    // Register plugins
    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init());

    // Desktop-only: system tray setup
    #[cfg(desktop)]
    {
        builder = builder.setup(|app| {
            desktop::setup_tray(app)?;
            Ok(())
        });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_app();
}
