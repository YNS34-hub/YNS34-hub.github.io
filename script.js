(() => {
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector("#primary-navigation");
  const navLinks = [...document.querySelectorAll('.primary-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll("main section[id]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const closeMenu = () => {
    menuButton?.setAttribute("aria-expanded", "false");
    navigation?.classList.remove("is-open");
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation?.classList.toggle("is-open", !isOpen);
  });

  navLinks.forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
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
      { rootMargin: "-25% 0px -58%", threshold: [0.05, 0.25, 0.6] }
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

  const visual = document.querySelector("[data-math-visual]");
  let frame = 0;
  if (visual && !reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
    visual.addEventListener("pointermove", (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = visual.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
        visual.style.setProperty("--mx", `${x}px`);
        visual.style.setProperty("--my", `${y}px`);
      });
    });
    visual.addEventListener("pointerleave", () => {
      visual.style.setProperty("--mx", "0px");
      visual.style.setProperty("--my", "0px");
    });
  }
})();
