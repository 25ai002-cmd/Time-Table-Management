function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Called the very first time a user completes the setup wizard.
 * Creates the institution root document.
 */
export async function createInstitution(institute) {
  const res = await fetch("/api/institution", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      institute,
      setupCompleted: true,
      standards: [],
      subjects: [],
      teachers: [],
      rooms: [],
      createdAt: new Date(),
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create institution");
  }
}

/**
 * Load all institution data for the current user.
 * Returns null if the document doesn't exist yet (brand-new signup).
 */
export async function loadInstitutionData(uid) {
  try {
    const res = await fetch("/api/institution", {
      headers: getHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load institution data");
    return await res.json();
  } catch (err) {
    console.error("[Backend] load error:", err);
    return null;
  }
}

/**
 * Auto-save all institution data on every change (debounced in App).
 */
export async function saveInstitutionData(uid, data) {
  const res = await fetch("/api/institution", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      institute: data.institute ?? null,
      standards: data.standards ?? [],
      subjects: data.subjects ?? [],
      teachers: data.teachers ?? [],
      rooms: data.rooms ?? [],
      setupCompleted: data.setupComplete ?? false,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to save institution data");
  }
}

/**
 * Complete the setup wizard — writes the initial institution document
 * then marks setupCompleted = true.
 */
export async function completeSetup(uid, institute) {
  const res = await fetch("/api/institution", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      institute,
      setupCompleted: true,
      standards: [],
      subjects: [],
      teachers: [],
      rooms: [],
      createdAt: new Date(),
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to complete setup");
  }
}
