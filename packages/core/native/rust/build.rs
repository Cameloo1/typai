fn main() {
    println!("cargo:rerun-if-changed=../cpp/typai_engine.cpp");
    println!("cargo:rerun-if-changed=../cpp/typai_engine.hpp");
    println!("cargo:rerun-if-changed=../cpp/dictionary.hpp");
    println!("cargo:rerun-if-changed=../cpp/common_typos.hpp");

    let mut build = cc::Build::new();
    build
        .cpp(true)
        .std("c++17")
        .file("../cpp/typai_engine.cpp")
        .include("../cpp")
        .flag_if_supported("-fno-exceptions")
        .flag_if_supported("-fno-rtti");

    if std::env::var("TARGET").is_ok_and(|target| target == "wasm32-unknown-unknown") {
        build.cpp_link_stdlib(None);
    }

    build.compile("typai_engine");
}
