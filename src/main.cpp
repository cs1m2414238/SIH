#include "AppController.h"
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    std::string configPath = "config/client_config.json";

    if (argc > 1) {
        configPath = argv[1];
    }

    AppController app;
    return app.run(configPath);
}
