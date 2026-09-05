const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-button");
const menuLabel = menuButton?.querySelector(".menu-label");
const navigation = document.querySelector("#primary-navigation");
const navLinks = [...document.querySelectorAll('.primary-nav a[href^="#"]')];
const sections = [...document.querySelectorAll("main section[id]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const closeMenu = () => {
  menuButton?.setAttribute("aria-expanded", "false");
  navigation?.classList.remove("is-open");
  if (menuLabel) menuLabel.textContent = "Menu";
};

menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navigation?.classList.toggle("is-open", open);
  if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
});

navLinks.forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const equationButton = document.querySelector(".equation-node");
const equationNote = document.querySelector("#equation-note");
equationButton?.addEventListener("click", () => {
  const expanded = equationButton.getAttribute("aria-expanded") === "true";
  equationButton.setAttribute("aria-expanded", String(!expanded));
  equationNote?.setAttribute("aria-hidden", String(expanded));
});

const sphereStage = document.querySelector("[data-sphere-stage]");
let sphere = null;
let sphereLoadTicket = 0;
let pageActive = true;

const loadNonlinearSphere = async () => {
  if (!pageActive) return;
  const ticket = ++sphereLoadTicket;
  sphere?.destroy();
  sphere = null;
  if (reducedMotion.matches) {
    sphereStage?.classList.add("is-fallback");
    if (sphereStage) sphereStage.dataset.renderMode = "reduced-motion-poster";
    return;
  }

  try {
    const { initNonlinearSphere } = await import("/sphere.js?v=20260905-2");
    if (ticket !== sphereLoadTicket || !pageActive) return;
    sphere = initNonlinearSphere(
      document.querySelector("[data-sphere-canvas]"),
      sphereStage,
      reducedMotion
    );
    if (!sphere) sphereStage?.classList.add("is-fallback");
    updateScrollState();
  } catch (error) {
    if (ticket !== sphereLoadTicket || !pageActive) return;
    console.warn("The interactive sculpture could not be loaded; showing its poster instead.", error);
    sphereStage?.classList.add("is-fallback");
    if (sphereStage) sphereStage.dataset.renderMode = "module-load-failed-poster";
  }
};

let scrollFrame = 0;
const updateScrollState = () => {
  scrollFrame = 0;
  const y = window.scrollY;
  header?.classList.toggle("is-scrolled", y > 18);

  const heroProgress = Math.max(0, Math.min(y / Math.max(window.innerHeight * 0.82, 1), 1));
  document.documentElement.style.setProperty("--hero-progress", heroProgress.toFixed(4));
  sphere?.setScroll(heroProgress);
};

const requestScrollUpdate = () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(updateScrollState);
};

updateScrollState();
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(loadNonlinearSphere, { timeout: 1200 });
} else {
  window.setTimeout(loadNonlinearSphere, 120);
}
window.addEventListener("pagehide", () => {
  pageActive = false;
  sphereLoadTicket += 1;
  sphere?.destroy();
  sphere = null;
});
window.addEventListener("pageshow", (event) => {
  pageActive = true;
  if (event.persisted) loadNonlinearSphere();
});
reducedMotion.addEventListener?.("change", loadNonlinearSphere);
window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", requestScrollUpdate, { passive: true });

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.09, rootMargin: "0px 0px -4%" }
  );
  document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      navLinks.forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-24% 0px -58%", threshold: [0.05, 0.25, 0.6] }
  );
  sections.forEach((section) => sectionObserver.observe(section));
} else {
  document.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
}

const workflowContent = {
  question: {
    number: "01 / 05",
    title: "State the question precisely.",
    copy: "Separate the mathematical problem, the claimed result, and the assumptions that connect them.",
    tags: ["scope", "claim", "hypotheses"]
  },
  challenge: {
    number: "02 / 05",
    title: "Make the assumptions visible.",
    copy: "Ask which hypotheses are essential, which are implicit, and where a proof may be using more than it states.",
    tags: ["hidden assumptions", "definitions", "edge cases"]
  },
  verify: {
    number: "03 / 05",
    title: "Trace every dependency.",
    copy: "Check proof steps, test implications, inspect boundary cases, and explore whether a counterexample could break the argument.",
    tags: ["proof steps", "implications", "counterexamples"]
  },
  refine: {
    number: "04 / 05",
    title: "Improve the argument’s surface.",
    copy: "Clarify notation, manuscript structure, academic English, LaTeX presentation, and citation coherence without changing the mathematics.",
    tags: ["notation", "language", "citations"]
  },
  human: {
    number: "05 / 05",
    title: "Return judgment to the researcher.",
    copy: "Treat every AI observation as a prompt for checking. The researcher verifies the mathematics and decides what belongs in the manuscript.",
    tags: ["verification", "judgment", "accountability"]
  }
};

const workflow = document.querySelector("[data-workflow]");
const workflowTitle = workflow?.querySelector("[data-workflow-title]");
const workflowCopy = workflow?.querySelector("[data-workflow-copy]");
const workflowTags = workflow?.querySelector("[data-workflow-tags]");
const workflowNumber = workflow?.querySelector(".workflow-status span");
const workflowSteps = [...(workflow?.querySelectorAll("[data-step]") || [])];

const setWorkflowStep = (button) => {
  const content = workflowContent[button.dataset.step];
  if (!content || !workflowTitle || !workflowCopy || !workflowTags || !workflowNumber) return;

  workflowSteps.forEach((step) => {
    const active = step === button;
    step.classList.toggle("is-active", active);
    step.setAttribute("aria-pressed", String(active));
  });

  workflowNumber.textContent = content.number;
  workflowTitle.textContent = content.title;
  workflowCopy.textContent = content.copy;
  workflowTags.replaceChildren(
    ...content.tags.map((tag) => {
      const span = document.createElement("span");
      span.textContent = tag;
      return span;
    })
  );
};

workflowSteps.forEach((button) => button.addEventListener("click", () => setWorkflowStep(button)));
