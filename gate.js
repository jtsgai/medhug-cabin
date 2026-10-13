(function () {
  if (location.pathname.endsWith("/enter.html")) return;
  fetch("https://live.medhug.ai/api/cabin-login", { credentials: "include" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (body) {
      if (!body || body.authenticated !== true) location.replace("/enter.html");
    })
    .catch(function () { location.replace("/enter.html"); });
})();
