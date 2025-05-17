// ============================================================================
// File Utilities & Template Replacement Helpers
// Cross-platform, robust utilities for file/directory copying and template
// placeholder replacement. No CLI or user interaction logic is present.
// ============================================================================

import fs from 'fs';
import path from 'path';

// -----------------------------------------------------------------------------
// File Copy Utilities
// -----------------------------------------------------------------------------

/**
 * Copies a file from src to dest, creating any necessary parent directories.
 * Throws an error if the operation fails.
 * @param {string} src - Source file path.
 * @param {string} dest - Destination file path.
 */
function copyFileSyncWithDirs(src, dest) {
    try {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
    } catch (err) {
        throw new Error(`Failed to copy file from "${src}" to "${dest}": ${err.message}`);
    }
}

/**
 * Recursively copies a directory from srcDir to destDir, including all files and subdirectories.
 * Throws an error if the operation fails.
 * @param {string} srcDir - Source directory path.
 * @param {string} destDir - Destination directory path.
 */
function copyDirRecursiveSync(srcDir, destDir) {
    try {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                copyDirRecursiveSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    } catch (err) {
        throw new Error(`Failed to recursively copy directory from "${srcDir}" to "${destDir}": ${err.message}`);
    }
}

// -----------------------------------------------------------------------------
// Template Replacement Utilities
// -----------------------------------------------------------------------------

/**
 * Replaces all {{key}} placeholders in the given content string with values from the replacements object.
 * If a placeholder key is not found in replacements, it is left unchanged.
 * @param {string} content - The content string containing placeholders.
 * @param {Object.<string, string>} replacements - Key-value pairs for replacement.
 * @returns {string} - The content with placeholders replaced.
 */
function replacePlaceholders(content, replacements) {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (key in replacements) {
            return replacements[key];
        }
        return match;
    });
}

/**
 * Recursively copies a directory from srcDir to destDir, replacing {{key}} placeholders in all files
 * with values from the replacements object. Subdirectories are processed recursively.
 * Throws an error if the operation fails.
 * @param {string} srcDir - Source directory path.
 * @param {string} destDir - Destination directory path.
 * @param {Object.<string, string>} replacements - Key-value pairs for template replacement.
 */
function copyDirRecursiveWithReplace(srcDir, destDir, replacements) {
    try {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                copyDirRecursiveWithReplace(srcPath, destPath, replacements);
            } else {
                const content = fs.readFileSync(srcPath, 'utf8');
                const replaced = replacePlaceholders(content, replacements);
                fs.writeFileSync(destPath, replaced, 'utf8');
            }
        }
    } catch (err) {
        throw new Error(`Failed to recursively copy directory with template replacement from "${srcDir}" to "${destDir}": ${err.message}`);
    }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
    copyDirRecursiveSync, copyDirRecursiveWithReplace, copyFileSyncWithDirs, replacePlaceholders
};
