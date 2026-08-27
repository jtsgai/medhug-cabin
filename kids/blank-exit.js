document.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".char-card, .logo-hit, .btn-stop, .jt-dock, a, button")) return;
  const stop = document.getElementById("btn-stop");
  if (stop && !stop.classList.contains("hidden")) stop.click();
});
