const path = require('path');
const fs = require('fs');

/**
 * Resolves the backend root (<root>/backend) and project root (<root>) safely
 * in both unbundled development files and single-file bundled builds.
 */
function resolveAppRoots(callerDirname) {
  let dir = path.resolve(callerDirname || __dirname);
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'server.js')) && fs.existsSync(path.join(dir, 'database'))) {
      return {
        backendRoot: dir,
        projectRoot: path.dirname(dir)
      };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback for standard backend/<subdir> layout
  const fallbackBackend = path.basename(callerDirname || __dirname) === 'backend'
    ? path.resolve(callerDirname || __dirname)
    : path.resolve(callerDirname || __dirname, '..');

  return {
    backendRoot: fallbackBackend,
    projectRoot: path.dirname(fallbackBackend)
  };
}

module.exports = { resolveAppRoots };

