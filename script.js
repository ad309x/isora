const canvas = document.getElementById("fieldCanvas");
const ctx = canvas.getContext("2d");
const FIELD_LINE_COLOR = "rgba(255, 180, 80, 0.72)";
const FIELD_LINE_GLOW = "rgba(255, 180, 80, 0.18)";
const EQUIP_LINE_COLOR = "rgba(90, 190, 255, 0.52)";
const ZERO_LINE_COLOR = "rgba(0, 255, 100, 0.92)";
let redrawQueued = false;
function queueDrawScene() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    drawScene();
  });
}
function resizeCanvas() {
  canvas.width = window.innerWidth - 200;
  canvas.height = window.innerHeight;
  drawScene();
}
window.addEventListener("resize", resizeCanvas);
let charges = [];
let showField = true;
let showEquip = true;
let showPotentialMap = false;
let equipDensity = 5;
let fieldDensity = 5;
let pixelsPerMeter = 100;
const defaultChargeMagnitudeC = 1e-6;
let nextChargeId = 1;
let showChargeValues = false;
let probeMode = false;
let probes = [];
let nextProbeId = 1;
resizeCanvas();
document.querySelectorAll(".particle").forEach((item) => {
  item.addEventListener("dragstart", (e) => {
    const isProton = item.classList.contains("proton");
    e.dataTransfer.setData("chargeType", isProton ? "proton" : "electron");
    const dragIcon = document.createElement("canvas");
    dragIcon.width = 40;
    dragIcon.height = 40;
    const ctx = dragIcon.getContext("2d");
    ctx.beginPath();
    ctx.arc(20, 20, 14, 0, Math.PI * 2);
    ctx.fillStyle = isProton ? "#ff4444" : "#4488ff";
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isProton ? "+" : "−", 20, 21);
    dragIcon.style.position = "absolute";
    dragIcon.style.top = "-100px";
    dragIcon.style.left = "-100px";
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 20, 20);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  });
});
canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const dropX = e.clientX - rect.left;
  const dropY = e.clientY - rect.top;
  const type = e.dataTransfer.getData("chargeType");
  const chargeSign = type === "proton" ? +1 : -1;
  const id = nextChargeId++;
  const label = `q${id}`;
  charges.push({
    id,
    label,
    x: dropX,
    y: dropY,
    q: chargeSign,
    magnitudeC: defaultChargeMagnitudeC,
  });
  updateHudCharges();
  updateSimStats();
  drawScene();
});
function drawScene() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (showPotentialMap && charges.length > 0) {
    drawPotentialMap();
  }
  if (showEquip && charges.length > 0) {
    drawEquipotentials();
  }
  if (showField && charges.length > 0) {
    drawFieldLines();
  }
  for (const c of charges) {
    drawCharge(c);
  }
  for (const p of probes) {
    drawProbe(p);
  }
}
function drawCharge(c) {
  const valueC = getChargeValueC(c);
  const isPositive = valueC > 0;
  const baseColor = isPositive ? "#ff4444" : "#4488ff";
  const glowColor = isPositive ? "rgba(255, 68, 68, 0.35)" : "rgba(68, 136, 255, 0.35)";
  const strength = Math.max(0.75, Math.min(2.4, Math.sqrt(Math.abs(valueC) / defaultChargeMagnitudeC)));
  const haloRadius = 18 + strength * 5;
  const gradient = ctx.createRadialGradient(c.x, c.y, 6, c.x, c.y, haloRadius);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(c.x, c.y, haloRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = baseColor;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = baseColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chargeText = showChargeValues ? formatChargeValue(valueC) : c.label;
  ctx.fillText(chargeText, c.x, c.y);
  ctx.restore();
}
function formatChargeValue(coulombs) {
  const sign = coulombs >= 0 ? "+" : "−";
  const a = Math.abs(coulombs);
  let val, unit;
  if (a >= 1) {
    val = a;
    unit = "C";
  } else if (a >= 1e-3) {
    val = a / 1e-3;
    unit = "mC";
  } else if (a >= 1e-6) {
    val = a / 1e-6;
    unit = "μC";
  } else if (a >= 1e-9) {
    val = a / 1e-9;
    unit = "nC";
  } else {
    val = a;
    unit = "C";
  }
  const text =
    val >= 100
      ? val.toFixed(0)
      : val >= 10
        ? val.toFixed(1)
        : val >= 1
          ? val.toFixed(2)
          : val.toPrecision(2);
  return `${sign}${text} ${unit}`;
}
function updateAllControlDisplays() {
  const toggleFieldEl = document.getElementById("toggleField");
  const toggleEquipEl = document.getElementById("toggleEquip");
  const togglePotentialEl = document.getElementById("togglePotential");
  const toggleChargeValuesEl = document.getElementById("toggleChargeValues");
  if (toggleFieldEl) toggleFieldEl.checked = showField;
  if (toggleEquipEl) toggleEquipEl.checked = showEquip;
  if (togglePotentialEl) togglePotentialEl.checked = showPotentialMap;
  if (toggleChargeValuesEl) toggleChargeValuesEl.checked = showChargeValues;
  const pxInput = document.getElementById("pxPerMeterInput");
  const scaleInfo = document.getElementById("scaleInfo");
  if (pxInput) pxInput.value = String(pixelsPerMeter);
  if (scaleInfo) scaleInfo.textContent = `${pixelsPerMeter} pixels = 1 meter`;
  const fieldSlider = document.getElementById("fieldDensity");
  const fieldValue = document.getElementById("fieldDensityVal");
  if (fieldSlider) fieldSlider.value = String(fieldDensity);
  if (fieldValue) fieldValue.textContent = String(fieldDensity);
  const equipSlider = document.getElementById("equipDensity");
  const equipValue = document.getElementById("equipDensityVal");
  if (equipSlider) equipSlider.value = String(equipDensity);
  if (equipValue) equipValue.textContent = String(equipDensity);
}
function updateHudCharges() {
  const box = document.getElementById("hudCharges");
  if (!box) return;
  box.innerHTML = "";
}
function updateSimStats() {
  const stats = document.getElementById("simStats");
  if (!stats) return;
  stats.innerHTML =
    `Charges: ${charges.length}<br>` + `Probes: ${probes.length}`;
}
const clearBtn = document.getElementById("clearBtn");
const clearProbesBtn = document.getElementById("clearProbesBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
let clearMode = "charges";
const clearConfirmWindow = document.getElementById("clearConfirmWindow");
const confirmClearYes = document.getElementById("confirmClearYes");
const confirmClearNo = document.getElementById("confirmClearNo");
const clearConfirmTitle = document.getElementById("clearConfirmTitle");
const clearConfirmMessage = document.getElementById("clearConfirmMessage");
const clearProbesConfirmWindow = document.getElementById(
  "clearProbesConfirmWindow",
);
const confirmClearProbesYes = document.getElementById("confirmClearProbesYes");
const confirmClearProbesNo = document.getElementById("confirmClearProbesNo");
if (clearBtn && clearConfirmWindow) {
  clearBtn.addEventListener("click", () => {
    clearMode = "charges";
    clearConfirmTitle.textContent = "Clear Charges?";
    clearConfirmMessage.textContent =
      "Are you sure you want to remove all charges?";
    clearConfirmWindow.classList.remove("hidden");
  });
}
if (clearProbesBtn && clearProbesConfirmWindow) {
  clearProbesBtn.addEventListener("click", () => {
    clearProbesConfirmWindow.classList.remove("hidden");
  });
}
if (clearAllBtn && clearConfirmWindow) {
  clearAllBtn.addEventListener("click", () => {
    clearMode = "all";
    clearConfirmTitle.textContent = "Clear All?";
    clearConfirmMessage.textContent =
      "Are you sure you want to remove everything?";
    clearConfirmWindow.classList.remove("hidden");
  });
}
if (confirmClearYes && clearConfirmWindow) {
  confirmClearYes.addEventListener("click", () => {
    charges = [];
    if (clearMode === "all") {
      probes = [];
      nextProbeId = 1;
    }
    updateHudCharges();
    updateSimStats();
    const display = document.getElementById("currentScenarioDisplay");
    if (display) {
      display.textContent = "Current Configuration: None";
    }
    drawScene();
    clearConfirmWindow.classList.add("hidden");
  });
}
if (confirmClearNo && clearConfirmWindow) {
  confirmClearNo.addEventListener("click", () => {
    clearConfirmWindow.classList.add("hidden");
  });
}
if (confirmClearProbesYes && clearProbesConfirmWindow) {
  confirmClearProbesYes.addEventListener("click", () => {
    probes = [];
    nextProbeId = 1;
    updateSimStats();
    drawScene();
    clearProbesConfirmWindow.classList.add("hidden");
  });
}
if (confirmClearProbesNo && clearProbesConfirmWindow) {
  confirmClearProbesNo.addEventListener("click", () => {
    clearProbesConfirmWindow.classList.add("hidden");
  });
}
if (clearProbesConfirmWindow) {
  clearProbesConfirmWindow.addEventListener("click", (e) => {
    if (e.target === clearProbesConfirmWindow) {
      clearProbesConfirmWindow.classList.add("hidden");
    }
  });
}
if (clearConfirmWindow) {
  clearConfirmWindow.addEventListener("click", (e) => {
    if (e.target === clearConfirmWindow) {
      clearConfirmWindow.classList.add("hidden");
    }
  });
}
function createSetupCode() {
  const setup = {
    version: 1,
    charges: charges.map((c) => ({
      xRatio: c.x / canvas.width,
      yRatio: c.y / canvas.height,
      q: c.q,
      magnitudeC: c.magnitudeC ?? defaultChargeMagnitudeC,
    })),
    probes: probes.map((p) => ({
      xRatio: p.x / canvas.width,
      yRatio: p.y / canvas.height,
    })),
    settings: {
      showField,
      showEquip,
      showPotentialMap,
      showChargeValues,
      pixelsPerMeter,
      fieldDensity,
      equipDensity,
    },
  };
  return "EMSIM:" + btoa(JSON.stringify(setup));
}
function loadSetupFromCode(code) {
  let cleaned = code.trim();
  if (cleaned.startsWith("EMSIM:")) {
    cleaned = cleaned.slice(6);
  }
  const setup = JSON.parse(atob(cleaned));
  if (!setup || setup.version !== 1) {
    throw new Error("Unsupported setup version.");
  }
  if (!Array.isArray(setup.charges)) {
    throw new Error("Missing charges.");
  }
  charges = [];
  probes = [];
  nextChargeId = 1;
  nextProbeId = 1;
  for (const savedCharge of setup.charges) {
    const id = nextChargeId++;
    charges.push({
      id,
      label: `q${id}`,
      x: savedCharge.xRatio * canvas.width,
      y: savedCharge.yRatio * canvas.height,
      q: savedCharge.q === -1 ? -1 : 1,
      magnitudeC:
        typeof savedCharge.magnitudeC === "number"
          ? savedCharge.magnitudeC
          : defaultChargeMagnitudeC,
    });
  }
  if (Array.isArray(setup.probes)) {
    for (const savedProbe of setup.probes) {
      const id = nextProbeId++;
      probes.push({
        id,
        label: `P${id}`,
        x: savedProbe.xRatio * canvas.width,
        y: savedProbe.yRatio * canvas.height,
      });
    }
  }
  if (setup.settings) {
    showField = setup.settings.showField !== false;
    showEquip = setup.settings.showEquip !== false;
    showPotentialMap = setup.settings.showPotentialMap === true;
    showChargeValues = setup.settings.showChargeValues === true;
    pixelsPerMeter =
      Number.isInteger(setup.settings.pixelsPerMeter) &&
      setup.settings.pixelsPerMeter >= 1 &&
      setup.settings.pixelsPerMeter <= 500
        ? setup.settings.pixelsPerMeter
        : 100;
    fieldDensity =
      Number.isInteger(setup.settings.fieldDensity) &&
      setup.settings.fieldDensity >= 1 &&
      setup.settings.fieldDensity <= 10
        ? setup.settings.fieldDensity
        : 5;
    equipDensity =
      Number.isInteger(setup.settings.equipDensity) &&
      setup.settings.equipDensity >= 1 &&
      setup.settings.equipDensity <= 10
        ? setup.settings.equipDensity
        : 5;
  }
  const display = document.getElementById("currentScenarioDisplay");
  if (display) {
    display.textContent = "Current Configuration: Loaded Saved Setup";
  }
  updateAllControlDisplays();
  updateHudCharges();
  updateSimStats();
  drawScene();
}
const saveSetupBtn = document.getElementById("saveSetupBtn");
const loadSetupBtn = document.getElementById("loadSetupBtn");
const saveSetupWindow = document.getElementById("saveSetupWindow");
const loadSetupWindow = document.getElementById("loadSetupWindow");
const closeSaveSetupBtn = document.getElementById("closeSaveSetupBtn");
const closeLoadSetupBtn = document.getElementById("closeLoadSetupBtn");
const saveSetupCode = document.getElementById("saveSetupCode");
const loadSetupCode = document.getElementById("loadSetupCode");
const copySetupCodeBtn = document.getElementById("copySetupCodeBtn");
const confirmLoadSetupBtn = document.getElementById("confirmLoadSetupBtn");
const copySetupStatus = document.getElementById("copySetupStatus");
const loadSetupError = document.getElementById("loadSetupError");
if (saveSetupBtn && saveSetupWindow && saveSetupCode) {
  saveSetupBtn.addEventListener("click", () => {
    saveSetupCode.value = createSetupCode();
    if (copySetupStatus) copySetupStatus.textContent = "";
    saveSetupWindow.classList.remove("hidden");
    saveSetupCode.focus();
    saveSetupCode.select();
  });
}
if (loadSetupBtn && loadSetupWindow) {
  loadSetupBtn.addEventListener("click", () => {
    if (loadSetupCode) loadSetupCode.value = "";
    if (loadSetupError) loadSetupError.textContent = "";
    loadSetupWindow.classList.remove("hidden");
    if (loadSetupCode) loadSetupCode.focus();
  });
}
if (closeSaveSetupBtn && saveSetupWindow) {
  closeSaveSetupBtn.addEventListener("click", () => {
    saveSetupWindow.classList.add("hidden");
  });
}
if (closeLoadSetupBtn && loadSetupWindow) {
  closeLoadSetupBtn.addEventListener("click", () => {
    loadSetupWindow.classList.add("hidden");
  });
}
if (saveSetupWindow) {
  saveSetupWindow.addEventListener("click", (e) => {
    if (e.target === saveSetupWindow) {
      saveSetupWindow.classList.add("hidden");
    }
  });
}
if (loadSetupWindow) {
  loadSetupWindow.addEventListener("click", (e) => {
    if (e.target === loadSetupWindow) {
      loadSetupWindow.classList.add("hidden");
    }
  });
}
if (copySetupCodeBtn && saveSetupCode) {
  copySetupCodeBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(saveSetupCode.value);
      if (copySetupStatus) copySetupStatus.textContent = "Copied!";
    } catch {
      saveSetupCode.focus();
      saveSetupCode.select();
      if (copySetupStatus) {
        copySetupStatus.textContent = "Select the code and copy it manually.";
      }
    }
  });
}
if (confirmLoadSetupBtn && loadSetupCode && loadSetupWindow) {
  confirmLoadSetupBtn.addEventListener("click", () => {
    try {
      loadSetupFromCode(loadSetupCode.value);
      loadSetupWindow.classList.add("hidden");
    } catch {
      if (loadSetupError) {
        loadSetupError.textContent =
          "Invalid setup code. Please check that you copied the full code.";
      }
    }
  });
}
const screenshotBtn = document.getElementById("screenshotBtn");
screenshotBtn.addEventListener("click", () => {
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "none";
  setTimeout(() => {
    const link = document.createElement("a");
    link.download = "image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    if (hud) hud.style.display = "block";
  }, 100);
});
const probeToolBtn = document.getElementById("probeToolBtn");
const resetDefaultsBtn = document.getElementById("resetDefaultsBtn");
if (resetDefaultsBtn) {
  resetDefaultsBtn.addEventListener("click", () => {
    showField = true;
    showEquip = true;
    showPotentialMap = false;
    showChargeValues = false;
    pixelsPerMeter = 100;
    fieldDensity = 5;
    equipDensity = 5;
    probeMode = false;
    if (probeToolBtn) {
      probeToolBtn.textContent = "Probe Tool: Off";
      probeToolBtn.classList.remove("active");
    }
    updateAllControlDisplays();
    drawScene();
  });
}
if (probeToolBtn) {
  probeToolBtn.addEventListener("click", () => {
    probeMode = !probeMode;
    probeToolBtn.textContent = probeMode ? "Probe Tool: On" : "Probe Tool: Off";
    probeToolBtn.classList.toggle("active", probeMode);
  });
}
let draggingCharge = null;
let isDragging = false;
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (probeMode && e.button === 0) {
    probes.push({
      id: nextProbeId,
      label: `P${nextProbeId}`,
      x,
      y,
    });
    nextProbeId++;
    updateSimStats();
    drawScene();
    return;
  }
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 15) {
      draggingCharge = c;
      isDragging = true;
      canvas.classList.add("dragging-charge");
      break;
    }
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (!isDragging || !draggingCharge) return;
  const rect = canvas.getBoundingClientRect();
  draggingCharge.x = e.clientX - rect.left;
  draggingCharge.y = e.clientY - rect.top;
  queueDrawScene();
});
canvas.addEventListener("mouseup", () => {
  isDragging = false;
  draggingCharge = null;
  canvas.classList.remove("dragging-charge");
});
canvas.addEventListener("dblclick", (e) => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let i = charges.length - 1; i >= 0; i--) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 15) {
      openChargeModal(c);
      break;
    }
  }
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (let i = probes.length - 1; i >= 0; i--) {
    const p = probes[i];
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 12) {
      probes.splice(i, 1);
      updateSimStats();
      drawScene();
      return;
    }
  }
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 15) {
      charges.splice(i, 1);
      updateHudCharges();
      updateSimStats();
      drawScene();
      break;
    }
  }
});
function computeElectricField(x, y) {
  let Ex = 0,
    Ey = 0;
  const k = 8.99e9;
  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const dx = dx_px / pixelsPerMeter;
    const dy = dy_px / pixelsPerMeter;
    const r2 = dx * dx + dy * dy;
    if (r2 === 0) continue;
    const r = Math.sqrt(r2);
    const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
    const E_mag = (k * qC) / r2;
    Ex += E_mag * (dx / r);
    Ey += E_mag * (dy / r);
  }
  return { Ex, Ey };
}
function computePotential(x, y) {
  const k = 8.99e9;
  let V = 0;
  for (const c of charges) {
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const dx = dx_px / pixelsPerMeter;
    const dy = dy_px / pixelsPerMeter;
    const r = Math.hypot(dx, dy);
    if (r === 0) continue;
    const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
    V += (k * qC) / r;
  }
  return V;
}
function formatNumberForProbe(value, unit) {
  if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(2)} ×10^6 ${unit}`;
  } else if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(2)} ×10^3 ${unit}`;
  } else if (Math.abs(value) >= 1) {
    return `${value.toFixed(2)} ${unit}`;
  } else {
    return `${value.toExponential(2)} ${unit}`;
  }
}
function drawProbe(p) {
  const V = computePotential(p.x, p.y);
  const { Ex, Ey } = computeElectricField(p.x, p.y);
  const Emag = Math.hypot(Ex, Ey);
  let angleDeg = (Math.atan2(-Ey, Ex) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 153, 0.55)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p.x - 16, p.y);
  ctx.lineTo(p.x + 16, p.y);
  ctx.moveTo(p.x, p.y - 16);
  ctx.lineTo(p.x, p.y + 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,255,153,0.95)";
  ctx.shadowColor = "rgba(0,255,153,0.85)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const x_m = (p.x / pixelsPerMeter).toFixed(2);
  const y_m = (p.y / pixelsPerMeter).toFixed(2);
  ctx.fillText(`${p.label}: (${x_m}, ${y_m}) m`, p.x + 12, p.y - 30);
  ctx.fillText(`V=${formatNumberForProbe(V, "V")}`, p.x + 12, p.y - 16);
  ctx.fillText(`|E|=${formatNumberForProbe(Emag, "N/C")}, θ=${angleDeg.toFixed(1)}°`, p.x + 12, p.y - 2);
  ctx.restore();
}
function getChargeValueC(charge) {
  return charge.q * (charge.magnitudeC ?? defaultChargeMagnitudeC);
}
function isInsideCanvas(x, y, margin = 0) {
  return x >= -margin && y >= -margin && x <= canvas.width + margin && y <= canvas.height + margin;
}
function nearestChargeDistance(x, y) {
  let minDist = Infinity;
  for (const c of charges) minDist = Math.min(minDist, Math.hypot(x - c.x, y - c.y));
  return minDist;
}
function normalizedFieldDirection(x, y, direction = 1) {
  const { Ex, Ey } = computeElectricField(x, y);
  const mag = Math.hypot(Ex, Ey);
  if (!Number.isFinite(mag) || mag < 1e-9) return null;
  return { x: (direction * Ex) / mag, y: (direction * Ey) / mag };
}
function traceFieldLine(x, y, direction = 1, step = 6, maxSteps = 1600) {
  const points = [{ x, y }];
  let px = x;
  let py = y;
  for (let i = 0; i < maxSteps; i++) {
    const d1 = normalizedFieldDirection(px, py, direction);
    if (!d1) break;
    const midX = px + d1.x * step * 0.5;
    const midY = py + d1.y * step * 0.5;
    const d2 = normalizedFieldDirection(midX, midY, direction) || d1;
    const nx = px + d2.x * step;
    const ny = py + d2.y * step;
    if (!isInsideCanvas(nx, ny, 2)) break;
    points.push({ x: nx, y: ny });
    px = nx;
    py = ny;
    if (nearestChargeDistance(px, py) < 16) break;
  }
  return points;
}
function samplePolylineForSpacing(points, every = 10) {
  const samples = [];
  for (let i = 0; i < points.length; i += every) {
    const p = points[i];
    if (!_nearAnyCharge(p.x, p.y, 38)) samples.push(p);
  }
  return samples;
}

function polylineTooClose(points, acceptedSamples, minSpacing) {
  const minSpacing2 = minSpacing * minSpacing;
  for (const p of samplePolylineForSpacing(points, 9)) {
    for (const q of acceptedSamples) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy < minSpacing2) return true;
    }
  }
  return false;
}

function rememberPolyline(points, acceptedSamples) {
  acceptedSamples.push(...samplePolylineForSpacing(points, 11));
}

function drawFieldPolyline(points, acceptedSamples = null, minSpacing = 0) {
  if (!points || points.length < 8) return false;
  if (acceptedSamples && minSpacing > 0 && polylineTooClose(points, acceptedSamples, minSpacing)) return false;
  drawProfessionalFieldLine(points);
  if (acceptedSamples) rememberPolyline(points, acceptedSamples);
  return true;
}
function edgeFadeFactor(p) {
  const m = 42;
  const d = Math.min(p.x, p.y, canvas.width - p.x, canvas.height - p.y);
  return Math.max(0.15, Math.min(1, d / m));
}
function drawSegmentedLine(points, color, baseWidth, alphaScale = 1) {
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const t = i / Math.max(1, points.length - 1);
    const fade = Math.min(edgeFadeFactor(p0), edgeFadeFactor(p1));
    const width = baseWidth * (1.15 - 0.35 * t);
    ctx.globalAlpha = alphaScale * fade;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawProfessionalFieldLine(points) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawSegmentedLine(points, FIELD_LINE_GLOW, 3.2, 0.9);
  drawSegmentedLine(points, FIELD_LINE_COLOR, 1.15, 1);
  ctx.restore();
  drawArrowsAlongLine(points, 95);
}
function traceFullFieldLine(x, y) {
  const backward = traceFieldLine(x, y, -1);
  const forward = traceFieldLine(x, y, 1);
  return backward.reverse().concat(forward.slice(1));
}

function makeEdgeSeeds(spacing) {
  const seeds = [];
  for (let x = spacing / 2; x < canvas.width; x += spacing) {
    seeds.push({ x, y: 2 }, { x, y: canvas.height - 2 });
  }
  for (let y = spacing / 2; y < canvas.height; y += spacing) {
    seeds.push({ x: 2, y }, { x: canvas.width - 2, y });
  }
  return seeds;
}

function drawFieldLines() {
  if (charges.length === 0) return;
  const positiveCharges = charges.filter((c) => getChargeValueC(c) > 0);
  const negativeCharges = charges.filter((c) => getChargeValueC(c) < 0);
  const sourceCharges = positiveCharges.length ? positiveCharges : negativeCharges;
  const traceDirection = positiveCharges.length ? 1 : -1;
  const baseSeeds = Math.max(8, Math.round(8 + fieldDensity * 2));
  const maxFieldLines = Math.max(52, Math.round(42 + fieldDensity * 12));
  const acceptedSamples = [];
  let drawn = 0;
  ctx.strokeStyle = "rgba(255, 180, 80, 0.72)";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Primary lines: keep the clean, evenly spaced look by seeding only from true source charges.
  // This avoids drawing the same physical field line twice from both ends of a dipole.
  for (const c of sourceCharges) {
    const weight = Math.max(0.5, Math.abs(getChargeValueC(c)) / defaultChargeMagnitudeC);
    const seeds = Math.max(10, Math.min(52, Math.round(baseSeeds * Math.sqrt(weight))));
    for (let i = 0; i < seeds; i++) {
      const angle = ((i + 0.5) / seeds) * 2 * Math.PI;
      const sx = c.x + 18 * Math.cos(angle);
      const sy = c.y + 18 * Math.sin(angle);
      if (!isInsideCanvas(sx, sy) || _nearAnyCharge(sx, sy, 15)) continue;
      const pts = traceFieldLine(sx, sy, traceDirection);
      // For an all-negative configuration, the trace is grown outward from the
      // negative charge, but field direction arrows should point inward.
      // Reverse only the display order so the visual line still covers the
      // screen while arrows point toward the negative charge.
      if (positiveCharges.length === 0) pts.reverse();
      if (drawFieldPolyline(pts, acceptedSamples)) drawn++;
      if (drawn >= maxFieldLines) return;
    }
  }

  // Supplemental whole-screen lines: add only lines that are not too close to existing ones.
  // The spacing is intentionally gentle so the screen fills in without collapsing to only a few lines.
  const edgeSpacing = Math.max(70, 250 - fieldDensity * 16);
  const minSpacing = Math.max(18, 38 - fieldDensity * 1.6);
  for (const seed of makeEdgeSeeds(edgeSpacing)) {
    if (_nearAnyCharge(seed.x, seed.y, 26)) continue;
    const pts = traceFullFieldLine(seed.x, seed.y);
    if (drawFieldPolyline(pts, acceptedSamples, minSpacing)) drawn++;
    if (drawn >= maxFieldLines) return;
  }
}
function localCurvature(points, i) {
  if (i < 2 || i > points.length - 3) return 0;
  const a1 = Math.atan2(points[i].y - points[i - 2].y, points[i].x - points[i - 2].x);
  const a2 = Math.atan2(points[i + 2].y - points[i].y, points[i + 2].x - points[i].x);
  let diff = Math.abs(a2 - a1);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}
function drawArrowsAlongLine(points, spacing = 100) {
  if (points.length < 2) return;
  let distance = spacing * 0.45;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLength = Math.hypot(dx, dy);
    const curvature = localCurvature(points, i);
    const targetSpacing = Math.max(70, spacing - curvature * 45);
    distance += segLength;
    if (distance > targetSpacing) {
      distance = 0;
      const fade = edgeFadeFactor(points[i]);
      const angle = Math.atan2(dy, dx);
      const size = 6;
      ctx.save();
      ctx.globalAlpha = 0.82 * fade;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i].x - size * Math.cos(angle - Math.PI / 6), points[i].y - size * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i].x - size * Math.cos(angle + Math.PI / 6), points[i].y - size * Math.sin(angle + Math.PI / 6));
      ctx.strokeStyle = "rgba(255,255,255,0.88)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}
function _nearAnyCharge(x, y, r = 18) {
  return charges.some((c) => Math.hypot(x - c.x, y - c.y) < r);
}
function contourLevels() {
  const samples = [];
  const step = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) / 70));
  for (let y = step / 2; y < canvas.height; y += step) {
    for (let x = step / 2; x < canvas.width; x += step) {
      if (_nearAnyCharge(x, y, 24)) continue;
      const v = computePotential(x, y);
      if (Number.isFinite(v) && Math.abs(v) > 1e-6) samples.push(Math.abs(v));
    }
  }
  if (!samples.length) return [];
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.08)];
  const hi = samples[Math.floor(samples.length * 0.92)];
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= 0) return [];
  const count = Math.max(4, Math.min(12, equipDensity + 3));
  const minLog = Math.log10(Math.max(lo, hi / 1e4));
  const maxLog = Math.log10(hi);
  const positive = Array.from({ length: count }, (_, i) => 10 ** (minLog + ((maxLog - minLog) * i) / Math.max(1, count - 1)));
  const hasPos = charges.some((c) => getChargeValueC(c) > 0);
  const hasNeg = charges.some((c) => getChargeValueC(c) < 0);
  return [
    ...(hasNeg ? positive.map((v) => -v).reverse() : []),
    ...(hasPos ? positive : []),
  ];
}
function interpolateContourPoint(x1, y1, v1, x2, y2, v2, level) {
  const denom = v2 - v1;
  const t = Math.abs(denom) < 1e-12 ? 0.5 : (level - v1) / denom;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}
function drawContourSegment(p1, p2) {
  if (!p1 || !p2) return;
  if (_nearAnyCharge(p1.x, p1.y, 17) || _nearAnyCharge(p2.x, p2.y, 17)) return;
  const fade = Math.min(edgeFadeFactor(p1), edgeFadeFactor(p2));
  ctx.save();
  ctx.globalAlpha = 0.22 * fade;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.globalAlpha = fade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}
function drawEquipotentials() {
  if (charges.length === 0) return;
  const step = equipDensity >= 8 ? 7 : equipDensity >= 5 ? 9 : 12;
  const cols = Math.ceil(canvas.width / step) + 1;
  const rows = Math.ceil(canvas.height / step) + 1;
  const values = Array.from({ length: rows }, (_, j) =>
    Array.from({ length: cols }, (_, i) => computePotential(i * step, j * step)),
  );
  ctx.strokeStyle = EQUIP_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const level of contourLevels()) {
    ctx.strokeStyle = EQUIP_LINE_COLOR;
    ctx.lineWidth = 1;
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const x = i * step;
        const y = j * step;
        const v0 = values[j][i];
        const v1 = values[j][i + 1];
        const v2 = values[j + 1][i + 1];
        const v3 = values[j + 1][i];
        const edgePoints = [];
        if ((v0 < level) !== (v1 < level)) edgePoints.push(interpolateContourPoint(x, y, v0, x + step, y, v1, level));
        if ((v1 < level) !== (v2 < level)) edgePoints.push(interpolateContourPoint(x + step, y, v1, x + step, y + step, v2, level));
        if ((v2 < level) !== (v3 < level)) edgePoints.push(interpolateContourPoint(x + step, y + step, v2, x, y + step, v3, level));
        if ((v3 < level) !== (v0 < level)) edgePoints.push(interpolateContourPoint(x, y + step, v3, x, y, v0, level));
        if (edgePoints.length === 2) {
          drawContourSegment(edgePoints[0], edgePoints[1]);
        } else if (edgePoints.length === 4) {
          drawContourSegment(edgePoints[0], edgePoints[1]);
          drawContourSegment(edgePoints[2], edgePoints[3]);
        }
      }
    }
  }
}
function drawPotentialMap() {
  const k = 8.99e9;
  const step = 6;
  const maxV = Math.max(1e3, (5e5 * charges.length) / pixelsPerMeter);
  const alpha = 0.4;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      let V = 0;
      for (const c of charges) {
        const dx = (x - c.x) / pixelsPerMeter;
        const dy = (y - c.y) / pixelsPerMeter;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 1e-6) continue;
        const qC = c.q * (c.magnitudeC ?? defaultChargeMagnitudeC);
        V += (k * qC) / r;
      }
      const color = voltageToColor(V, maxV, alpha);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.save();
  ctx.strokeStyle = ZERO_LINE_COLOR;
  ctx.shadowColor = ZERO_LINE_COLOR;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  for (let y = 0; y < canvas.height - step; y += step) {
    for (let x = 0; x < canvas.width - step; x += step) {
      const V00 = computePotential(x, y);
      const V10 = computePotential(x + step, y);
      const V01 = computePotential(x, y + step);
      const V11 = computePotential(x + step, y + step);
      const allPos = V00 > 0 && V10 > 0 && V01 > 0 && V11 > 0;
      const allNeg = V00 < 0 && V10 < 0 && V01 < 0 && V11 < 0;
      if (allPos || allNeg) continue;
      ctx.beginPath();
      if (V00 > 0 !== V10 > 0) {
        const t = Math.abs(V00) / (Math.abs(V00) + Math.abs(V10));
        ctx.moveTo(x + t * step, y);
      }
      if (V10 > 0 !== V11 > 0) {
        const t = Math.abs(V10) / (Math.abs(V10) + Math.abs(V11));
        ctx.lineTo(x + step, y + t * step);
      }
      if (V11 > 0 !== V01 > 0) {
        const t = Math.abs(V11) / (Math.abs(V11) + Math.abs(V01));
        ctx.lineTo(x + (1 - t) * step, y + step);
      }
      if (V01 > 0 !== V00 > 0) {
        const t = Math.abs(V01) / (Math.abs(V01) + Math.abs(V00));
        ctx.lineTo(x, y + (1 - t) * step);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function voltageToColor(V, maxV, alpha = 0.4) {
  const clamp = Math.max(-maxV, Math.min(maxV, V));
  const norm = clamp / maxV;
  const red = norm > 0 ? 255 * norm : 0;
  const blue = norm < 0 ? 255 * -norm : 0;
  const green = 60;
  return `rgba(${red.toFixed(0)},${green.toFixed(0)},${blue.toFixed(0)},${alpha})`;
}
const toggleFieldEl = document.getElementById("toggleField");
if (toggleFieldEl) {
  toggleFieldEl.checked = true;
  toggleFieldEl.addEventListener("change", (e) => {
    showField = e.target.checked;
    drawScene();
  });
}
const toggleEquipEl = document.getElementById("toggleEquip");
if (toggleEquipEl) {
  toggleEquipEl.checked = true;
  toggleEquipEl.addEventListener("change", (e) => {
    showEquip = e.target.checked;
    drawScene();
  });
}
const togglePotentialEl = document.getElementById("togglePotential");
if (togglePotentialEl) {
  togglePotentialEl.addEventListener("change", (e) => {
    showPotentialMap = e.target.checked;
    drawScene();
  });
}
const toggleChargeValuesEl = document.getElementById("toggleChargeValues");
if (toggleChargeValuesEl) {
  toggleChargeValuesEl.addEventListener("change", (e) => {
    showChargeValues = e.target.checked;
    drawScene();
  });
}
const pxInput = document.getElementById("pxPerMeterInput");
const scaleInfo = document.getElementById("scaleInfo");
const scaleError = document.getElementById("scaleError");
function applyScaleValue(val) {
  pixelsPerMeter = val;
  if (scaleInfo) scaleInfo.textContent = `${val} pixels = 1 meter`;
  drawScene();
}
function validateAndApplyScale() {
  if (!pxInput) return;
  const raw = pxInput.value.trim();
  const val = Number(raw);
  const valid =
    Number.isFinite(val) && Number.isInteger(val) && val >= 1 && val <= 500;
  if (valid) {
    pxInput.classList.remove("invalid");
    if (scaleError) scaleError.style.display = "none";
    applyScaleValue(val);
  } else {
    pxInput.classList.add("invalid");
    if (scaleError) scaleError.style.display = "block";
  }
}
if (pxInput) {
  pxInput.value = String(pixelsPerMeter);
  if (scaleInfo) scaleInfo.textContent = `${pixelsPerMeter} pixels = 1 meter`;
  pxInput.addEventListener("input", validateAndApplyScale);
  pxInput.addEventListener("change", validateAndApplyScale);
  pxInput.addEventListener("blur", validateAndApplyScale);
}
const fieldSlider = document.getElementById("fieldDensity");
const fieldValue = document.getElementById("fieldDensityVal");
if (fieldSlider && fieldValue) {
  fieldValue.textContent = String(fieldDensity);
  fieldSlider.value = String(fieldDensity);
  fieldSlider.addEventListener("input", (e) => {
    fieldDensity = Number(e.target.value);
    fieldValue.textContent = String(fieldDensity);
    drawScene();
  });
}
const densSlider = document.getElementById("equipDensity");
const densValue = document.getElementById("equipDensityVal");
if (densSlider && densValue) {
  densValue.textContent = String(equipDensity);
  densSlider.value = String(equipDensity);
  densSlider.addEventListener("input", (e) => {
    equipDensity = Number(e.target.value);
    densValue.textContent = String(equipDensity);
    drawScene();
  });
}
const chargeModal = document.getElementById("chargeModal");
const closeBtn = document.getElementById("closeChargeModal");
const saveBtn = document.getElementById("saveChargeBtn");
const titleEl = document.getElementById("chargeTitle");
const mantissaEl = document.getElementById("mantissaInput");
const exponentEl = document.getElementById("exponentInput");
const chargeErrEl = document.getElementById("chargeError");
let editingCharge = null;
function openChargeModal(charge) {
  const tooltip = document.getElementById("chargeTooltip");
  if (tooltip) tooltip.classList.add("hidden");
  editingCharge = charge;
  const mag = charge.magnitudeC ?? defaultChargeMagnitudeC;
  const absMag = Math.abs(mag);
  let exponent = 0,
    mantissa = absMag;
  if (absMag > 0) {
    exponent = Math.floor(Math.log10(absMag));
    mantissa = absMag / Math.pow(10, exponent);
    if (mantissa >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
  }
  titleEl.textContent = `Edit charge (${charge.label})`;
  mantissaEl.value = mantissa.toString();
  exponentEl.value = exponent.toString();
  chargeErrEl.style.display = "none";
  chargeModal.classList.remove("hidden");
  chargeModal.setAttribute("aria-hidden", "false");
  mantissaEl.focus();
}
function closeChargeModal() {
  chargeModal.classList.add("hidden");
  chargeModal.setAttribute("aria-hidden", "true");
  editingCharge = null;
}
if (closeBtn) {
  closeBtn.addEventListener("click", closeChargeModal);
}
if (chargeModal) {
  chargeModal.addEventListener("click", (e) => {
    if (e.target === chargeModal) closeChargeModal();
  });
}
function saveChargeFromModal() {
  if (!editingCharge) return;
  const mant = Number(mantissaEl.value);
  const exp = Number(exponentEl.value);
  const validMant = Number.isFinite(mant) && mant > 0;
  const validExp =
    Number.isFinite(exp) && Number.isInteger(exp) && exp >= -12 && exp <= 12;
  if (!validMant || !validExp) {
    chargeErrEl.style.display = "block";
    return;
  }
  editingCharge.magnitudeC = mant * Math.pow(10, exp);
  updateHudCharges();
  drawScene();
  closeChargeModal();
}
function makeCharge(x, y, sign, magnitudeC = defaultChargeMagnitudeC) {
  const id = nextChargeId++;
  return {
    id,
    label: `q${id}`,
    x,
    y,
    q: sign,
    magnitudeC,
  };
}
const scenarioNames = {
  singlePositive: "Single Positive Charge",
  singleNegative: "Single Negative Charge",
  dipole: "Electric Dipole",
  unequalDipole: "Unequal Dipole",
  twoPositive: "Two Positive Charges",
  threeLine: "Three Charges in a Line",
  quadrupole: "Quadrupole",
  triangle: "Charge Triangle",
  fourPositiveSquare: "Four Positive Charges",
  parallelPlates: "Parallel Plates",
};
function loadScenario(name) {
  charges = [];
  nextChargeId = 1;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  if (name === "singlePositive") {
    charges.push(makeCharge(cx, cy, +1));
  }
  if (name === "dipole") {
    charges.push(makeCharge(cx - 90, cy, +1));
    charges.push(makeCharge(cx + 90, cy, -1));
  }
  if (name === "twoPositive") {
    charges.push(makeCharge(cx - 90, cy, +1));
    charges.push(makeCharge(cx + 90, cy, +1));
  }
  if (name === "quadrupole") {
    charges.push(makeCharge(cx - 80, cy - 80, +1));
    charges.push(makeCharge(cx + 80, cy - 80, -1));
    charges.push(makeCharge(cx - 80, cy + 80, -1));
    charges.push(makeCharge(cx + 80, cy + 80, +1));
  }
  if (name === "parallelPlates") {
    const spacing = 35;
    for (let i = -4; i <= 4; i++) {
      charges.push(makeCharge(cx - 150, cy + i * spacing, +1, 5e-7));
      charges.push(makeCharge(cx + 150, cy + i * spacing, -1, 5e-7));
    }
  }
  if (name === "singleNegative") {
    charges.push(makeCharge(cx, cy, -1));
  }
  if (name === "unequalDipole") {
    charges.push(makeCharge(cx - 90, cy, +1, 2e-6));
    charges.push(makeCharge(cx + 90, cy, -1, 1e-6));
  }
  if (name === "threeLine") {
    charges.push(makeCharge(cx - 120, cy, +1));
    charges.push(makeCharge(cx, cy, -1));
    charges.push(makeCharge(cx + 120, cy, +1));
  }
  if (name === "triangle") {
    charges.push(makeCharge(cx, cy - 110, +1));
    charges.push(makeCharge(cx - 100, cy + 80, -1));
    charges.push(makeCharge(cx + 100, cy + 80, +1));
  }
  if (name === "fourPositiveSquare") {
    charges.push(makeCharge(cx - 90, cy - 90, +1));
    charges.push(makeCharge(cx + 90, cy - 90, +1));
    charges.push(makeCharge(cx - 90, cy + 90, +1));
    charges.push(makeCharge(cx + 90, cy + 90, +1));
  }
  updateHudCharges();
  updateSimStats();
  const display = document.getElementById("currentScenarioDisplay");
  if (display) {
    display.textContent =
      "Current Configuration: " + (scenarioNames[name] || "Custom");
  }
  drawScene();
}
const openScenariosBtn = document.getElementById("openScenariosBtn");
const closeScenariosBtn = document.getElementById("closeScenariosBtn");
const scenarioWindow = document.getElementById("scenarioWindow");
if (openScenariosBtn && scenarioWindow) {
  openScenariosBtn.addEventListener("click", () => {
    scenarioWindow.classList.remove("hidden");
  });
}
if (closeScenariosBtn && scenarioWindow) {
  closeScenariosBtn.addEventListener("click", () => {
    scenarioWindow.classList.add("hidden");
  });
}
if (scenarioWindow) {
  scenarioWindow.addEventListener("click", (e) => {
    if (e.target === scenarioWindow) {
      scenarioWindow.classList.add("hidden");
    }
  });
}
document.querySelectorAll(".scenarioBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    loadScenario(btn.dataset.scenario);
    if (scenarioWindow) scenarioWindow.classList.add("hidden");
  });
});
const scenarioDescriptions = {
  singlePositive:
    "A single positive charge. Field lines point outward, and equipotential lines form circles around the charge.",
  singleNegative:
    "A single negative charge. Field lines point inward toward the charge, and equipotential lines form circles around it.",
  dipole:
    "A positive and negative charge of equal magnitude. Field lines travel from the positive charge to the negative charge.",
  unequalDipole:
    "A positive and negative charge with different magnitudes. The field pattern becomes asymmetric.",
  twoPositive:
    "Two equal positive charges. Field lines repel away from both charges, with a low-field region between them.",
  threeLine:
    "Three charges arranged in a line. This setup demonstrates superposition and field cancellation.",
  quadrupole:
    "Four alternating charges in a square-like pattern. This creates a more complex multipole field.",
  triangle:
    "Three charges arranged in a triangle. This shows how geometry affects electric field and potential patterns.",
  fourPositiveSquare:
    "Four positive charges at the corners of a square. The center has strong symmetry and field cancellation.",
  parallelPlates:
    "Two rows of opposite charges approximating parallel plates. The field between them is nearly uniform.",
};
const scenarioTooltip = document.createElement("div");
scenarioTooltip.id = "scenarioDescriptionTooltip";
scenarioTooltip.classList.add("hidden");
document.body.appendChild(scenarioTooltip);
document.querySelectorAll(".scenarioBtn").forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    const key = btn.dataset.scenario;
    scenarioTooltip.textContent = scenarioDescriptions[key] || "";
    scenarioTooltip.classList.remove("hidden");
  });
  btn.addEventListener("mousemove", (e) => {
    scenarioTooltip.style.left = `${e.clientX + 14}px`;
    scenarioTooltip.style.top = `${e.clientY + 14}px`;
  });
  btn.addEventListener("mouseleave", () => {
    scenarioTooltip.classList.add("hidden");
  });
});
const openInstructionsBtn = document.getElementById("openInstructionsBtn");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");
const instructionsWindow = document.getElementById("instructionsWindow");
if (openInstructionsBtn && instructionsWindow) {
  openInstructionsBtn.addEventListener("click", () => {
    instructionsWindow.classList.remove("hidden");
  });
}
if (closeInstructionsBtn && instructionsWindow) {
  closeInstructionsBtn.addEventListener("click", () => {
    instructionsWindow.classList.add("hidden");
  });
}
if (instructionsWindow) {
  instructionsWindow.addEventListener("click", (e) => {
    if (e.target === instructionsWindow) {
      instructionsWindow.classList.add("hidden");
    }
  });
}
window.addEventListener("load", () => {
  if (instructionsWindow) {
    instructionsWindow.classList.remove("hidden");
  }
});
const openTogglesBtn = document.getElementById("openTogglesBtn");
const closeTogglesBtn = document.getElementById("closeTogglesBtn");
const togglesWindow = document.getElementById("togglesWindow");
if (openTogglesBtn && togglesWindow) {
  openTogglesBtn.addEventListener("click", () => {
    togglesWindow.classList.remove("hidden");
  });
}
if (closeTogglesBtn && togglesWindow) {
  closeTogglesBtn.addEventListener("click", () => {
    togglesWindow.classList.add("hidden");
  });
}
if (togglesWindow) {
  togglesWindow.addEventListener("click", (e) => {
    if (e.target === togglesWindow) {
      togglesWindow.classList.add("hidden");
    }
  });
}
if (saveBtn) {
  saveBtn.addEventListener("click", saveChargeFromModal);
}
const tooltip = document.getElementById("chargeTooltip");
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  let found = null;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) {
      found = c;
      break;
    }
  }
  if (found) {
    const qC = found.q * (found.magnitudeC ?? defaultChargeMagnitudeC);
    const formattedQ = formatChargeValue(qC);
    const x_m = (found.x / pixelsPerMeter).toFixed(2);
    const y_m = (found.y / pixelsPerMeter).toFixed(2);
    tooltip.innerHTML = `
      <b>${found.label}</b><br>
      Charge: ${formattedQ}<br>
      Position: (${x_m}, ${y_m}) m
    `;
    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
    tooltip.classList.remove("hidden");
  } else {
    tooltip.classList.add("hidden");
  }
});
const hud = document.getElementById("hud");
const hudDist = document.getElementById("hudDist");
const hudE = document.getElementById("hudE");
const hudV = document.getElementById("hudV");
canvas.addEventListener("mousemove", (e) => {
  if (!hud) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (charges.length === 1 && hudDist) {
    const c = charges[0];
    const dx_px = x - c.x;
    const dy_px = y - c.y;
    const d_px = Math.hypot(dx_px, dy_px);
    const d_m = d_px / pixelsPerMeter;
    const pxText = `${Math.round(d_px)} pixels`;
    const mText =
      d_m >= 1 ? `${d_m.toFixed(2)} m` : `${d_m.toExponential(2)} m`;
    hudDist.textContent = `Distance: ${pxText}, ${mText}`;
  } else if (hudDist) {
    hudDist.textContent = "";
  }
  if (charges.length === 0) {
    if (hudE) hudE.textContent = "E: —";
    if (hudV) hudV.textContent = "V: —";
    return;
  }
  const V = computePotential(x, y);
  let vTxt;
  if (Math.abs(V) >= 1e6) {
    vTxt = `${(V / 1e6).toFixed(2)} ×10^6 V`;
  } else if (Math.abs(V) >= 1e3) {
    vTxt = `${(V / 1e3).toFixed(2)} ×10^3 V`;
  } else if (Math.abs(V) >= 1) {
    vTxt = `${V.toFixed(2)} V`;
  } else {
    vTxt = `${V.toExponential(2)} V`;
  }
  if (hudV) hudV.textContent = `V: ${vTxt}`;
  const { Ex, Ey } = computeElectricField(x, y);
  const Emag = Math.hypot(Ex, Ey);
  let txt;
  if (Emag >= 1e6) {
    txt = `${(Emag / 1e6).toFixed(2)} ×10^6 N/C`;
  } else if (Emag >= 1e3) {
    txt = `${(Emag / 1e3).toFixed(2)} ×10^3 N/C`;
  } else if (Emag >= 1) {
    txt = `${Emag.toFixed(2)} N/C`;
  } else {
    txt = `${Emag.toExponential(2)} N/C`;
  }
  if (hudE) hudE.textContent = `E: ${txt}`;
});
canvas.addEventListener("mouseleave", () => {
  if (hudDist) hudDist.textContent = "";
  if (hudE) hudE.textContent = "E: —";
  if (hudV) hudV.textContent = "V: —";
});
drawScene();
updateSimStats();