const DEFAULT_ROSTER_URL = "https://contourcandidate.web.app/api/roster";
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PAGES = 20;

class RosterError extends Error {
  constructor(message, { status = 502, code = "UPSTREAM_ERROR" } = {}) {
    super(message);
    this.name = "RosterError";
    this.status = status;
    this.code = code;
  }
}

let cache = {
  staff: null,
  fetchedAt: 0,
};
let inflight = null;

function getApiKey() {
  return (
    process.env.CONTOUR_ROSTER_API_KEY ||
    process.env.ROSTER_API_KEY ||
    ""
  );
}

function getCacheTtlMs() {
  const parsed = Number(process.env.CONTOUR_ROSTER_CACHE_TTL_MS);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_CACHE_TTL_MS;
}

function normalizeStaff(person = {}) {
  return {
    name: String(person.name || "").trim(),
    email: String(person.email || "").trim(),
    role: String(person.role || "").trim(),
    classes: Array.isArray(person.classes)
      ? person.classes.map((value) => String(value).trim()).filter(Boolean)
      : [],
  };
}

function mergeStaff(existing, incoming) {
  const seen = new Set(
    existing
      .map((person) => person.email.toLowerCase())
      .filter(Boolean)
  );
  const merged = [...existing];

  for (const person of incoming) {
    const key = person.email.toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(person);
  }

  return merged;
}

function isFresh(now, ttlMs) {
  return Boolean(cache.staff) && now - cache.fetchedAt < ttlMs;
}

async function fetchRosterPage({ page, apiKey, rosterUrl, fetchImpl }) {
  const target = new URL(rosterUrl);
  target.searchParams.set("page", String(page));
  target.searchParams.set("api_key", apiKey);

  let response;

  try {
    response = await fetchImpl(target);
  } catch {
    throw new RosterError("Unable to reach the Contour roster API", {
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
    });
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new RosterError(
      payload?.message || "Roster API key is missing or not recognised",
      { status: 401, code: payload?.code || "INVALID_KEY" }
    );
  }

  if (response.status === 429) {
    throw new RosterError(
      payload?.message || "Roster API rate limit exceeded. Try again later.",
      { status: 429, code: payload?.code || "RATE_LIMITED" }
    );
  }

  if (!response.ok || !payload || payload.status === "error") {
    throw new RosterError(payload?.message || "Unable to load staff roster", {
      status: 502,
      code: payload?.code || "UPSTREAM_ERROR",
    });
  }

  return payload;
}

async function fetchAllStaff({ apiKey, rosterUrl, fetchImpl }) {
  const staff = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const payload = await fetchRosterPage({
      page,
      apiKey,
      rosterUrl,
      fetchImpl,
    });
    const pageStaff = Array.isArray(payload.staff)
      ? payload.staff.map(normalizeStaff)
      : [];

    staff.push(...pageStaff);
    totalPages = Number(payload.total_pages) || page;

    const nextPage = Number(payload.next_page);

    if (Number.isInteger(nextPage) && nextPage > page) {
      page = nextPage;
    } else {
      page += 1;
    }
  }

  return mergeStaff([], staff);
}

async function getCachedRoster(options = {}) {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? getCacheTtlMs();
  const apiKey = options.apiKey ?? getApiKey();
  const rosterUrl = options.rosterUrl || DEFAULT_ROSTER_URL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!apiKey) {
    throw new RosterError("Roster API is not configured", {
      status: 503,
      code: "NOT_CONFIGURED",
    });
  }

  if (!options.force && isFresh(now, ttlMs)) {
    return {
      staff: cache.staff,
      cached: true,
      stale: false,
    };
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const staff = await fetchAllStaff({ apiKey, rosterUrl, fetchImpl });
      cache = {
        staff,
        fetchedAt: now,
      };

      return {
        staff,
        cached: false,
        stale: false,
      };
    } catch (error) {
      if (error.status === 429 && cache.staff) {
        return {
          staff: cache.staff,
          cached: true,
          stale: true,
        };
      }

      throw error;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function resetRosterCache() {
  cache = {
    staff: null,
    fetchedAt: 0,
  };
  inflight = null;
}

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_ROSTER_URL,
  RosterError,
  getCachedRoster,
  resetRosterCache,
};
