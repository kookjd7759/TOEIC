const repoConfig = {
  owner: "kookjd7759",
  repo: "TOEIC",
  branch: "main",
};

const readmes = [
  { path: "README.md", slug: "overview", title: "Course Overview", label: "Course Overview" },
  { path: "Basic Grammar/README.md", slug: "basic-grammar", title: "Basic Grammar", label: "Basic Grammar" },
  { path: "Basic Grammar/Unit 1/README.md", slug: "unit-1", title: "Unit 1 - Parts of Speech", label: "Unit 1" },
  { path: "Basic Grammar/Unit 2/README.md", slug: "unit-2", title: "Unit 2 - Nouns", label: "Unit 2" },
  { path: "Basic Grammar/Unit 3/README.md", slug: "unit-3", title: "Unit 3 - Verbs", label: "Unit 3" },
  { path: "Basic Grammar/Unit 4/README.md", slug: "unit-4", title: "Unit 4 - Adjectives & Adverbs", label: "Unit 4" },
  { path: "Basic Grammar/Unit 5/README.md", slug: "unit-5", title: "Unit 5 - Prepositions", label: "Unit 5" },
  { path: "Basic Grammar/Unit 6/README.md", slug: "unit-6", title: "Unit 6 - Conjunctions", label: "Unit 6" },
  { path: "Words/README.md", slug: "vocabulary", title: "Vocabulary Notes", label: "Words" },
];

const treeRoot = document.querySelector("#tree");
const lessonRoot = document.querySelector("#lesson");
const currentTitle = document.querySelector("#currentTitle");
const sidebarToggle = document.querySelector("#sidebarToggle");

marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

function buildRawFileUrl(path) {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://raw.githubusercontent.com/${repoConfig.owner}/${repoConfig.repo}/${repoConfig.branch}/${encodedPath}`;
}

function buildFetchCandidates(path) {
  const repoPath = path === "README.md" ? "docs/README.md" : path;
  const relativeCandidates = path === "README.md"
    ? ["README.md", "docs/README.md", "../docs/README.md"]
    : [`../${path}`, path, `docs/${path}`];

  const candidates = [...relativeCandidates, buildRawFileUrl(repoPath)];
  return [...new Set(candidates)];
}

async function fetchReadmeWithFallback(path) {
  const candidates = buildFetchCandidates(path);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const requestUrl = candidate.startsWith("http") ? candidate : encodeURI(candidate);
      const response = await fetch(requestUrl, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`${response.status} ${response.statusText} (${candidate})`);
        continue;
      }

      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = new Error(`${message} (${candidate})`);
    }
  }

  throw lastError ?? new Error("Could not fetch note content.");
}

function createTree(paths) {
  const root = { name: "TOEIC", type: "folder", path: null, title: null, children: new Map() };

  for (const file of paths) {
    const parts = file.path.split("/");
    let node = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const isStudyNote = isFile && part.toLowerCase() === "readme.md";

      if (isStudyNote && parts.length > 1) {
        node.path = file.path;
        node.title = file.title;
        return;
      }

      if (!node.children.has(part)) {
        node.children.set(part, {
          name: isStudyNote ? file.label : part,
          type: isFile ? "file" : "folder",
          path: isFile ? file.path : null,
          title: isFile ? file.title : null,
          children: new Map(),
        });
      }
      node = node.children.get(part);
    });
  }

  return root;
}

function renderTreeNode(node) {
  const list = document.createElement("ul");
  list.className = "tree-list";

  for (const child of node.children.values()) {
    const item = document.createElement("li");
    item.className = `tree-item tree-${child.type}`;
    const hasChildren = child.children.size > 0;

    const row = document.createElement("div");
    row.className = "tree-row";

    const toggle = document.createElement("button");
    toggle.className = "tree-toggle";
    toggle.type = "button";
    toggle.textContent = child.type === "folder" && hasChildren ? ">" : "";
    toggle.ariaLabel = `${child.name} toggle`;

    const main = document.createElement("button");
    main.className = "tree-main";
    main.type = "button";
    main.disabled = !child.path;
    main.dataset.path = child.path ?? "";

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = child.name;

    main.append(label);
    row.append(toggle, main);
    item.append(row);

    if (child.type === "folder" && hasChildren) {
      toggle.addEventListener("click", () => {
        item.classList.toggle("is-open");
      });
      item.append(renderTreeNode(child));
    } else {
      toggle.disabled = true;
    }

    if (child.path) {
      main.addEventListener("click", () => {
        loadReadme(child.path, { updateHash: true });
        if (window.matchMedia("(max-width: 860px)").matches) {
          document.body.classList.add("sidebar-collapsed");
        }
      });
    }

    list.append(item);
  }

  return list;
}

function normalizeHashPath() {
  const value = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const file = readmes.find((entry) => entry.slug === value || entry.path === value);
  return file ? file.path : readmes[0].path;
}

function setActive(path) {
  document.querySelectorAll(".tree-main").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.path === path);
  });
}

async function loadReadme(path, options = {}) {
  const { updateHash = false } = options;
  const file = readmes.find((entry) => entry.path === path) ?? readmes[0];
  currentTitle.textContent = file.title;
  setActive(file.path);

  if (updateHash && window.location.hash !== `#${file.slug}`) {
    window.location.hash = file.slug;
  }

  lessonRoot.innerHTML = "<p>Loading lesson...</p>";

  try {
    const markdown = await fetchReadmeWithFallback(file.path);
    const html = marked.parse(markdown);
    lessonRoot.innerHTML = DOMPurify.sanitize(html, {
      ADD_ATTR: ["target"],
    });
  } catch (error) {
    lessonRoot.innerHTML = `
      <div class="error">
        <strong>Could not load this lesson note.</strong>
        <p>${file.path}</p>
        <p>Tried: ${buildFetchCandidates(file.path).join(" | ")}</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

treeRoot.append(renderTreeNode(createTree(readmes)));
sidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

window.addEventListener("hashchange", () => {
  loadReadme(normalizeHashPath());
});

if (window.matchMedia("(max-width: 860px)").matches) {
  document.body.classList.add("sidebar-collapsed");
}

window.history.replaceState(null, "", "#overview");
loadReadme(readmes[0].path);
