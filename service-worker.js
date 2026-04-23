const APP_SHELL_CACHE = "walkingman-app-shell-v3";
const IMAGE_CACHE = "walkingman-images-v3";
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];
const IMAGE_ASSETS = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
      caches.open(IMAGE_CACHE).then((cache) => cache.addAll(IMAGE_ASSETS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("walkingman-") && key !== APP_SHELL_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isAppShellAsset(request) {
  const url = new URL(request.url);
  return (
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("manifest.json")
  );
}

function isImageAsset(request) {
  return request.destination === "image";
}

async function updateCache(cacheName, request, response) {
  if (!response.ok) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    await updateCache(APP_SHELL_CACHE, "./index.html", response.clone());
    return response;
  } catch (error) {
    const cache = await caches.open(APP_SHELL_CACHE);
    return (await cache.match("./index.html")) || Response.error();
  }
}

async function handleAppShellAsset(request) {
  try {
    const response = await fetch(request);
    return await updateCache(APP_SHELL_CACHE, request, response);
  } catch (error) {
    const cache = await caches.open(APP_SHELL_CACHE);
    return (await cache.match(request)) || Response.error();
  }
}

async function handleImageAsset(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    return await updateCache(IMAGE_CACHE, request, response);
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isAppShellAsset(request)) {
    event.respondWith(handleAppShellAsset(request));
    return;
  }

  if (isImageAsset(request)) {
    event.respondWith(handleImageAsset(request));
  }
});
