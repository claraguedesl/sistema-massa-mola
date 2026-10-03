const $ = (selector) => document.querySelector(selector);

const controls = {
  mass: $("#mass-input"),
  spring: $("#spring-input"),
  displacement: $("#displacement-input"),
  velocity: $("#velocity-input"),
  friction: $("#friction-toggle"),
  damping: $("#damping-input"),
  step: $("#step-input"),
};

const ui = {
  start: $("#start-button"),
  reset: $("#reset-button"),
  status: $("#status"),
  time: $("#time-value"),
  velocity: $("#velocity-value"),
  mass: $("#mass"),
  spring: $("#spring"),
  position: $("#position-label"),
  elastic: $("#elastic-value"),
  kinetic: $("#kinetic-value"),
  mechanical: $("#mechanical-value"),
  equation: $("#equation"),
  explanation: $("#euler-explanation"),
  validation: $("#validation-message"),
};

let parameters;
let state;
let initialEnergies;
let isRunning = false;
let previousFrame = 0;
let accumulator = 0;

function readParameters() {
  const values = {
    mass: Number(controls.mass.value),
    spring: Number(controls.spring.value),
    x0: Number(controls.displacement.value),
    v0: Number(controls.velocity.value),
    damping: Number(controls.damping.value),
    dt: Number(controls.step.value),
    friction: controls.friction.checked,
  };

  const valid = Number.isFinite(values.mass) && values.mass > 0
    && Number.isFinite(values.spring) && values.spring > 0
    && Number.isFinite(values.x0) && Number.isFinite(values.v0)
    && Number.isFinite(values.damping) && values.damping >= 0
    && Number.isFinite(values.dt) && values.dt > 0;

  if (!valid) {
    throw new Error("Preencha os parâmetros com números válidos. Massa, k e Δt devem ser maiores que zero.");
  }
  if (values.dt > 0.02) {
    throw new Error("Para manter a simulação estável, use um passo Δt de até 0,02 s.");
  }
  return values;
}

function calculateEnergies(x, velocity) {
  const elastic = 0.5 * parameters.spring * x * x;
  const kinetic = 0.5 * parameters.mass * velocity * velocity;
  return { elastic, kinetic, mechanical: elastic + kinetic };
}

function setRunning(running) {
  isRunning = running;
  ui.start.textContent = running ? "Ⅱ Pausar" : "▶ Iniciar";
  ui.status.textContent = running ? "Em execução" : "Pausado";
  ui.status.classList.toggle("is-running", running);
}

function formatNumber(value, digits = 4) {
  return value.toFixed(digits).replace(".", ",");
}

function formatSigned(value, digits = 4) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return formatNumber(0, digits);
  return `${rounded > 0 ? "+" : "−"}${formatNumber(Math.abs(rounded), digits)}`;
}

function updateScene() {
  const equilibriumX = 390;
  const pixelsPerMeter = 190;
  const massWidth = 82;
  const left = Math.max(105, Math.min(638, equilibriumX + state.x * pixelsPerMeter));
  const center = left + massWidth / 2;
  const anchorX = 80;
  const springStart = anchorX + 5;
  const springEnd = left;
  const coils = 13;
  const amplitude = 13;
  const points = [`${springStart},163`, `${springStart + 12},163`];
  const usableLength = Math.max(12, springEnd - springStart - 24);
  const segment = usableLength / (coils * 2);

  for (let i = 0; i < coils * 2; i += 1) {
    const x = springStart + 12 + segment * (i + 1);
    const y = i === coils * 2 - 1 ? 163 : (i % 2 === 0 ? 163 - amplitude : 163 + amplitude);
    points.push(`${x},${y}`);
  }
  points.push(`${springEnd},163`);
  ui.spring.setAttribute("d", `M ${points.join(" L ")}`);
  ui.mass.setAttribute("x", left);
  $("#mass-label").setAttribute("x", center);
  $("#position-label").setAttribute("x", center);
  $("#position-label").textContent = `x = ${formatNumber(state.x, 2)} m`;
  ui.time.textContent = `${formatNumber(state.time)} s`;
  ui.velocity.textContent = `${formatNumber(state.velocity)} m/s`;
}

function updateEnergyChart(energies) {
  const changes = {
    elastic: energies.elastic - initialEnergies.elastic,
    kinetic: energies.kinetic - initialEnergies.kinetic,
    mechanical: energies.mechanical - initialEnergies.mechanical,
  };
  const referenceEnergy = Math.max(initialEnergies.mechanical, 1e-9);
  const largestChange = Math.max(...Object.values(changes).map(Math.abs));
  const chartScale = Math.max(referenceEnergy, largestChange);
  const displayedScalePercent = Math.max(100, chartScale / referenceEnergy * 100);
  $("#scale-value").textContent = Math.round(displayedScalePercent);
  $("#scale-value-right").textContent = Math.round(displayedScalePercent);

  for (const [name, change] of Object.entries(changes)) {
    const row = $(`[data-energy="${name}"]`);
    const bar = row.querySelector(".change-bar");
    const percentOfScale = chartScale > 0 ? Math.min(50, Math.abs(change) / chartScale * 50) : 0;
    bar.style.width = `${percentOfScale}%`;
    bar.style.left = change < 0 ? `${50 - percentOfScale}%` : "50%";
    bar.classList.toggle("is-negative", change < 0);
    row.querySelector(".energy-change").textContent = `${formatSigned(change)} J`;
    row.querySelector(".energy-change").classList.toggle("negative-text", change < 0);
  }

  ui.elastic.textContent = `${formatNumber(energies.elastic)} J`;
  ui.kinetic.textContent = `${formatNumber(energies.kinetic)} J`;
  ui.mechanical.textContent = `${formatNumber(energies.mechanical)} J`;
}

function render() {
  const energies = calculateEnergies(state.x, state.velocity);
  updateScene();
  updateEnergyChart(energies);
  updateExplanation(energies);
}

function updateExplanation(energies) {
  const dampingForce = parameters.friction ? -parameters.damping * state.velocity : 0;
  const springForce = -parameters.spring * state.x;
  const acceleration = (springForce + dampingForce) / parameters.mass;
  const nextVelocity = state.velocity + acceleration * parameters.dt;
  const nextPosition = state.x + nextVelocity * parameters.dt;
  const frictionDescription = parameters.friction
    ? `F<sub>atrito</sub> = −bv = ${formatSigned(dampingForce)} N`
    : "F<sub>atrito</sub> = 0 N (desligado)";

  ui.explanation.innerHTML = [
    `<b>1. Parâmetros:</b> m = ${formatNumber(parameters.mass)} kg; k = ${formatNumber(parameters.spring)} N/m; Δt = ${formatNumber(parameters.dt, 4)} s; x<sub>n</sub> = ${formatSigned(state.x)} m; v<sub>n</sub> = ${formatSigned(state.velocity)} m/s.`,
    `<b>2. Forças:</b> F<sub>mola</sub> = −kx = ${formatSigned(springForce)} N; ${frictionDescription}.`,
    `<b>3. Aceleração:</b> a = (F<sub>mola</sub> + F<sub>atrito</sub>) / m = (${formatSigned(springForce)} + (${formatSigned(dampingForce)}) ) / ${formatNumber(parameters.mass)} = ${formatSigned(acceleration)} m/s².`,
    `<b>4. Euler-Cromer:</b> v<sub>n+1</sub> = v<sub>n</sub> + aΔt = ${formatSigned(nextVelocity)} m/s; x<sub>n+1</sub> = x<sub>n</sub> + v<sub>n+1</sub>Δt = ${formatSigned(nextPosition)} m.`,
    `<b>5. Energias atuais:</b> E<sub>p</sub> = ${formatNumber(energies.elastic)} J; E<sub>c</sub> = ${formatNumber(energies.kinetic)} J; E<sub>m</sub> = ${formatNumber(energies.mechanical)} J.`,
  ].map((line) => `<div>${line}</div>`).join("");
}

function resetSimulation() {
  try {
    parameters = readParameters();
    state = { x: parameters.x0, velocity: parameters.v0, time: 0 };
    initialEnergies = calculateEnergies(state.x, state.velocity);
    accumulator = 0;
    ui.validation.textContent = "";
    controls.damping.disabled = !parameters.friction;
    ui.equation.textContent = parameters.friction ? "a = (−kx − bv) / m" : "a = −kx / m";
    setRunning(false);
    render();
  } catch (error) {
    setRunning(false);
    ui.validation.textContent = error.message;
  }
}

function eulerCromerStep() {
  const dampingForce = parameters.friction ? parameters.damping * state.velocity : 0;
  const acceleration = (-parameters.spring * state.x - dampingForce) / parameters.mass;
  const nextVelocity = state.velocity + acceleration * parameters.dt;
  const nextX = state.x + nextVelocity * parameters.dt;
  state.x = nextX;
  state.velocity = nextVelocity;
  state.time += parameters.dt;
}

function animate(timestamp) {
  if (!isRunning) return;
  if (previousFrame === 0) previousFrame = timestamp;
  accumulator += Math.min((timestamp - previousFrame) / 1000, 0.1);
  previousFrame = timestamp;

  let steps = 0;
  while (accumulator >= parameters.dt && steps < 5000) {
    eulerCromerStep();
    accumulator -= parameters.dt;
    steps += 1;
  }
  render();
  requestAnimationFrame(animate);
}

ui.start.addEventListener("click", () => {
  if (isRunning) {
    setRunning(false);
    previousFrame = 0;
    return;
  }
  try {
    parameters = readParameters();
    ui.validation.textContent = "";
    setRunning(true);
    previousFrame = 0;
    requestAnimationFrame(animate);
  } catch (error) {
    ui.validation.textContent = error.message;
  }
});

ui.reset.addEventListener("click", resetSimulation);
for (const input of Object.values(controls)) {
  input.addEventListener("change", resetSimulation);
}

resetSimulation();
