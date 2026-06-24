const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve("dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const requestPath = decodeURIComponent(url.pathname);
  let filePath = path.join(root, requestPath);

  if (
    !filePath.startsWith(root) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    filePath = path.join(root, "index.html");
  }

  res.writeHead(200, {
    "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
});

async function run() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const home = await fetch(`http://127.0.0.1:${port}/`);
    const homeText = await home.text();
    const deep = await fetch(`http://127.0.0.1:${port}/projects`);
    const deepText = await deep.text();
    const htmlAssetMatch = homeText.match(/<script[^>]+src="([^"]+\.js)"/);
    if (!htmlAssetMatch) {
      throw new Error("Built HTML did not include a JavaScript entrypoint.");
    }
    const js = await fetch(`http://127.0.0.1:${port}${htmlAssetMatch[1]}`);
    const jsText = await js.text();

    if (!home.ok || !deep.ok || !js.ok) {
      throw new Error("Unexpected HTTP status from local static server.");
    }
    if (!homeText.includes("<title>Ankit | Portfolio</title>")) {
      throw new Error("Homepage title was not found.");
    }
    if (!deepText.includes('<div id="root"></div>')) {
      throw new Error("SPA fallback did not return index.html.");
    }
    if (jsText.length < 1000) {
      throw new Error("Main JavaScript asset response looked too small.");
    }

    console.log(
      `Smoke test passed: home ${home.status}, deep route ${deep.status}, main JS bytes ${jsText.length}.`,
    );
  } finally {
    server.close();
  }
}

run().catch((error) => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
