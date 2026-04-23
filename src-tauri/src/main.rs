// Предотвращаем появление консольного окна на Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kontentum_studio_lib::run()
}
