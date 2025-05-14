#include <QApplication>
#include <QWebEngineView>
#include <QWebChannel>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QWebEnginePage>
#include <QFile>
#include <QDir>
#include <QFileInfo>
#include <QDebug>
#include <QCommandLineParser>
#include <QCommandLineOption>
#include <QStandardPaths>
#include <QWebEngineUrlScheme>
#include <QWebEngineUrlSchemeHandler>
#include <QMainWindow>
#include "backendobject.h"
#include "mywebview.h"
#include "mywebpage.h"

// Custom message handler for logging
void messageHandler(QtMsgType type, const QMessageLogContext &context, const QString &msg) {
    QString logMessage;

    // Format based on message type    
    switch (type) {
    case QtDebugMsg:
        logMessage = QString("Debug: %1").arg(msg);
        break;
    case QtInfoMsg:
        logMessage = QString("Info: %1").arg(msg);
        break;
    case QtWarningMsg:
        logMessage = QString("Warning: %1").arg(msg);
        break;
    case QtCriticalMsg:
        logMessage = QString("Critical: %1").arg(msg);
        break;
    case QtFatalMsg:
        logMessage = QString("Fatal: %1").arg(msg);
        break;
    }

    // Output to console
    fprintf(stderr, "%s\n", qPrintable(logMessage));
}

// Helper function for minimal initialization logging
void notifyPageLoaded(MyWebView *view) {
    // Connect to loadFinished signal to log that the page has loaded
    QObject::connect(view->page(), &QWebEnginePage::loadFinished, [view](bool ok) {
        if (!ok) {
            qWarning() << "Page failed to load properly";
            return;
        }

        qInfo() << "Page loaded successfully";

        // Log that the page initialization is complete
        QString statusCheck = "console.log('Qt WebEngine connected - Page is fully loaded');";
        view->page()->runJavaScript(statusCheck, [](const QVariant &) {
            qInfo() << "Page initialization complete";
        });
    });
}

// Main function
int main(int argc, char *argv[]) {
    // Set application info
    QString appName = QFileInfo(argv[0]).fileName();
    QCoreApplication::setApplicationName(appName);
    QCoreApplication::setOrganizationName("Taqyon");
    QCoreApplication::setApplicationVersion("1.0.0");

    // Create the application
    QApplication app(argc, argv);

    // Create the command line parser
    QCommandLineParser parser;
    parser.setApplicationDescription("Taqyon Desktop Application");
    parser.addHelpOption();
    parser.addVersionOption();

    // Add verbose option
    QCommandLineOption verboseOption(QStringList() << "verbose", "Enable verbose output");
    parser.addOption(verboseOption);

    // Add log file option
    QCommandLineOption logFileOption(QStringList() << "l" << "log", "Write logs to <file>", "file");
    parser.addOption(logFileOption);

    // Add dev-server option
    QCommandLineOption devServerOption(QStringList() << "d" << "dev-server", "Connect to dev server at <url>", "url", "http://localhost:3000");
    parser.addOption(devServerOption);

    // Add frontend-path option
    QCommandLineOption frontendPathOption(QStringList() << "f" << "frontend-path", "Path to frontend dist directory", "path");
    parser.addOption(frontendPathOption);

    parser.process(QCoreApplication::arguments());
    
    // Configure logging based on options
    bool verbose = parser.isSet(verboseOption);

    if (verbose) {
        qInstallMessageHandler(messageHandler);
        qInfo() << "Verbose mode enabled";
        qInfo() << "Application directory:" << QCoreApplication::applicationDirPath();
    }

    // Log to file if requested
    QFile *logFile = nullptr;
    if (parser.isSet(logFileOption)) {
        QString logPath = parser.value(logFileOption);
        logFile = new QFile(logPath);
        if (logFile->open(QIODevice::WriteOnly | QIODevice::Text | QIODevice::Append)) {
            qInfo() << "Logging to file:" << logPath;
        } else {
            qWarning() << "Could not open log file for writing:" << logPath;
            delete logFile;
            logFile = nullptr;
        }
    }

    // Create the main window
    QMainWindow mainWindow;
    mainWindow.setWindowTitle("Taqyon App");
    mainWindow.resize(1200, 800);

    // Create the web view and page
    MyWebView *webView = new MyWebView(&mainWindow);
    MyWebPage *webPage = new MyWebPage(QWebEngineProfile::defaultProfile(), webView);
    webView->setPage(webPage);

    // Configure web engine settings
    webPage->settings()->setAttribute(QWebEngineSettings::JavascriptEnabled, true);
    webPage->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, true);
    webPage->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
    webPage->settings()->setAttribute(QWebEngineSettings::AllowRunningInsecureContent, true);

    // Create the web channel
    QWebChannel channel;
    BackendObject backend;

    // Connect signal handlers for debugging
    if (verbose) {
        QObject::connect(&backend, &BackendObject::countChanged, [](int count) {
            qInfo() << "Backend count changed to: " << count;
        });
    }
    
    channel.registerObject(QStringLiteral("backend"), &backend);
    webPage->setWebChannel(&channel);
    
    // Simple notification when page is loaded
    notifyPageLoaded(webView);

    // Determine the frontend URL
    QUrl frontendUrl;

    // Load from dev server if requested
    if (parser.isSet(devServerOption)) {
        QString devServerUrl = parser.value(devServerOption);
        frontendUrl = QUrl(devServerUrl);
        qInfo() << "Loading frontend from dev server:" << devServerUrl;
    } else {
        // Load from local file
        QString frontendPath;
        
        if (parser.isSet(frontendPathOption)) {
            // Use the provided frontend path
            frontendPath = parser.value(frontendPathOption);
            qInfo() << "Using provided frontend path:" << frontendPath;
        } else {
            // Try to find the frontend path
            frontendPath = QCoreApplication::applicationDirPath() + "/../frontend/dist";
            
            // Check if the directory exists
            QDir frontendDir(frontendPath);
            if (!frontendDir.exists()) {
                qWarning() << "Frontend directory not found at:" << frontendPath;

                // Try to find the frontend path in other common locations
                QStringList possiblePaths = {
                    QCoreApplication::applicationDirPath() + "/frontend/dist",
                    QDir::currentPath() + "/frontend/dist",
                    QDir::currentPath() + "/../frontend/dist",
                    QDir::currentPath() + "/../../frontend/dist",
                    QDir::currentPath() + "/../../../frontend/dist"
                };
                
                bool found = false;
                for (const QString &path : possiblePaths) {
                    qInfo() << "Checking for frontend at:" << path;
                    QDir dir(path);
                    if (dir.exists()) {
                        frontendPath = path;
                        found = true;
                        qInfo() << "Found frontend at:" << frontendPath;
                        break;
                    }
                }
                
                // If the frontend path is not found, log an error and exit
                if (!found) {
                    qCritical() << "Could not find frontend directory in any of the expected locations.";
                    qInfo() << "Please specify the frontend path with --frontend-path option.";
                    return 1;
                }
            }
        }

        // Verify index.html exists
        QString indexPath = frontendPath + "/index.html";
        QFileInfo indexFile(indexPath);

        // If the index.html file does not exist, log an error and exit
        if (!indexFile.exists()) {
            qCritical() << "index.html not found at:" << indexPath;
            qInfo() << "Make sure you've built the frontend with 'npm run frontend:build'";
            return 1;
        }

        // Log that the frontend is being loaded
        qInfo() << "Loading frontend from:" << indexPath;
        frontendUrl = QUrl::fromLocalFile(indexPath);
    }

    // Console message logging is now handled in the frontend's qwebchannel-loader.js

    // Load the URL
    webView->setUrl(frontendUrl);

    // Show the window
    mainWindow.setCentralWidget(webView);
    mainWindow.show();

    // Run the application
    int result = app.exec();

    // Clean up
    if (logFile) {
        logFile->close();
        delete logFile;
    }
    return result;
} 