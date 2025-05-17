#!/usr/bin/env node

import { Command } from 'commander';

// Import the createApp function for the create-app subcommand
import { createApp } from './create-app.js';

const program = new Command();

program
  .name('taqyon')
  .description('Taqyon CLI - Rapid cross-platform app scaffolding')
  .version('1.0.0')
  .option('-d, --debug', 'Enable debug logging')
  .option('-v, --verbose', 'Enable verbose logging (alias for --debug)');

// Middleware to handle global debug/verbose flags
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.debug || opts.verbose) {
    process.env.TAQYON_CLI_DEBUG = '1';
    // Optionally, you could set up a logger here or pass this flag to submodules
    // For now, we just set an env var for submodules to check
  }
});

// create-app subcommand
program
  .command('create-app')
  .description('Scaffold a new Taqyon application')
  .action(async () => {
    try {
      await createApp();
    } catch (err) {
      console.error('Error:', err.message || err);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

export { };
