import { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseNaturalLanguageQuery } from "../services/queryParser";
import { uuidv7 } from "uuidv7";
import axios from "axios";

const prisma = new PrismaClient();

interface ValidationError { status: number; message: string; }

function runValidation(req: Request): ValidationError | null {
  const { gender, age_group, min_age, max_age, min_gender_probability,
    min_country_probability, sort_by, order, page, limit } = req.query;

  const VALID_GENDERS = ["male", "female"];
  const VALID_AGE_GROUPS = ["child", "teenager", "adult", "senior"];
  const VALID_SORT_BY = ["age", "created_at", "gender_probability"];
  const VALID_ORDERS = ["asc", "desc"];

  if (gender !== undefined && !VALID_GENDERS.includes(gender as string))
    return { status: 422, message: `Invalid query parameters: gender must be one of ${VALID_GENDERS.join(", ")}` };
  if (age_group !== undefined && !VALID_AGE_GROUPS.includes(age_group as string))
    return { status: 422, message: `Invalid query parameters: age_group must be one of ${VALID_AGE_GROUPS.join(", ")}` };
  if (min_age !== undefined && (isNaN(Number(min_age)) || !Number.isInteger(Number(min_age)) || Number(min_age) < 0))
    return { status: 422, message: "Invalid query parameters: min_age must be a non-negative integer" };
  if (max_age !== undefined && (isNaN(Number(max_age)) || !Number.isInteger(Number(max_age)) || Number(max_age) < 0))
    return { status: 422, message: "Invalid query parameters: max_age must be a non-negative integer" };
  if (min_age !== undefined && max_age !== undefined && Number(min_age) > Number(max_age))
    return { status: 422, message: "Invalid query parameters: min_age cannot be greater than max_age" };
  if (min_gender_probability !== undefined && (isNaN(Number(min_gender_probability)) || Number(min_gender_probability) < 0 || Number(min_gender_probability) > 1))
    return { status: 422, message: "Invalid query parameters: min_gender_probability must be a float between 0 and 1" };
  if (min_country_probability !== undefined && (isNaN(Number(min_country_probability)) || Number(min_country_probability) < 0 || Number(min_country_probability) > 1))
    return { status: 422, message: "Invalid query parameters: min_country_probability must be a float between 0 and 1" };
  if (sort_by !== undefined && !VALID_SORT_BY.includes(sort_by as string))
    return { status: 422, message: `Invalid query parameters: sort_by must be one of ${VALID_SORT_BY.join(", ")}` };
  if (order !== undefined && !VALID_ORDERS.includes(order as string))
    return { status: 422, message: `Invalid query parameters: order must be one of ${VALID_ORDERS.join(", ")}` };
  if (page !== undefined && (isNaN(Number(page)) || !Number.isInteger(Number(page)) || Number(page) < 1))
    return { status: 422, message: "Invalid query parameters: page must be a positive integer" };
  if (limit !== undefined && (isNaN(Number(limit)) || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 50))
    return { status: 422, message: "Invalid query parameters: limit must be an integer between 1 and 50" };

  return null;
}

function runPaginationValidation(req: Request): ValidationError | null {
  const { page, limit } = req.query;
  if (page !== undefined && (isNaN(Number(page)) || !Number.isInteger(Number(page)) || Number(page) < 1))
    return { status: 422, message: "Invalid query parameters: page must be a positive integer" };
  if (limit !== undefined && (isNaN(Number(limit)) || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 50))
    return { status: 422, message: "Invalid query parameters: limit must be an integer between 1 and 50" };
  return null;
}

function getAgeGroup(age: number): string {
  if (age <= 12) return "child";
  if (age <= 17) return "teenager";
  if (age <= 64) return "adult";
  return "senior";
}

function getCountryName(countryId: string): string {
  const map: Record<string, string> = {
    NG: "Nigeria", GH: "Ghana", KE: "Kenya", ET: "Ethiopia",
    TZ: "Tanzania", UG: "Uganda", AO: "Angola", CM: "Cameroon",
    ZA: "South Africa", EG: "Egypt", MA: "Morocco", DZ: "Algeria",
    SN: "Senegal", ML: "Mali", NE: "Niger", BF: "Burkina Faso",
    GN: "Guinea", BJ: "Benin", TG: "Togo", CI: "Ivory Coast",
    LR: "Liberia", SL: "Sierra Leone", ZM: "Zambia", ZW: "Zimbabwe",
    MZ: "Mozambique", MW: "Malawi", BW: "Botswana", NA: "Namibia",
    RW: "Rwanda", BI: "Burundi", SO: "Somalia", SD: "Sudan",
    TD: "Chad", CG: "Congo", CD: "DR Congo", GA: "Gabon",
    ER: "Eritrea", DJ: "Djibouti", MG: "Madagascar", MU: "Mauritius",
    GM: "Gambia", LY: "Libya", TN: "Tunisia", US: "United States",
    GB: "United Kingdom", FR: "France", DE: "Germany", IN: "India",
    CN: "China", BR: "Brazil", CA: "Canada", AU: "Australia", JP: "Japan",
  };
  return map[countryId] || countryId;
}

function buildQueryString(
  query: Record<string, unknown>,
  exclude: string[] = []
): string {
  const result: string[] = [];
  for (const [key, val] of Object.entries(query)) {
    if (exclude.includes(key)) continue;
    if (val === undefined || val === null) continue;
    let strVal = "";
    if (Array.isArray(val)) {
      strVal = val.length > 0 ? String(val[0]) : "";
    } else if (typeof val === "object") {
      strVal = JSON.stringify(val);
    } else {
      strVal = String(val);
    }
    result.push(`${key}=${encodeURIComponent(strVal)}`);
  }
  return result.join("&");
}

function buildWhereClause(query: Record<string, unknown>): Prisma.ProfileWhereInput {
  const where: Prisma.ProfileWhereInput = {};

  if (query.gender) where.gender = query.gender as string;
  if (query.age_group) where.age_group = query.age_group as string;
  if (query.country_id) where.country_id = (query.country_id as string).toUpperCase();

  const minAge = query.min_age !== undefined ? Number(query.min_age) : undefined;
  const maxAge = query.max_age !== undefined ? Number(query.max_age) : undefined;

  if (minAge !== undefined || maxAge !== undefined) {
    where.age = {};
    if (minAge !== undefined) (where.age as Prisma.IntFilter).gte = minAge;
    if (maxAge !== undefined) (where.age as Prisma.IntFilter).lte = maxAge;
  }

  if (query.min_gender_probability !== undefined) {
    where.gender_probability = { gte: Number(query.min_gender_probability) };
  }

  if (query.min_country_probability !== undefined) {
    where.country_probability = { gte: Number(query.min_country_probability) };
  }

  return where;
}

function buildWhereFromParsed(
  parsed: ReturnType<typeof parseNaturalLanguageQuery>
): Prisma.ProfileWhereInput {
  if (!parsed) return {};
  const where: Prisma.ProfileWhereInput = {};

  if (parsed.gender) where.gender = parsed.gender;
  if (parsed.age_group) where.age_group = parsed.age_group;
  if (parsed.country_id) where.country_id = parsed.country_id;

  if (parsed.min_age !== undefined || parsed.max_age !== undefined) {
    where.age = {};
    if (parsed.min_age !== undefined) (where.age as Prisma.IntFilter).gte = parsed.min_age;
    if (parsed.max_age !== undefined) (where.age as Prisma.IntFilter).lte = parsed.max_age;
  }

  return where;
}

function buildOrderBy(query: Record<string, unknown>): Prisma.ProfileOrderByWithRelationInput {
  const sortBy = (query.sort_by as string) || "created_at";
  const order = (query.order as "asc" | "desc") || "asc";
  return { [sortBy]: order };
}

function buildPagination(query: Record<string, unknown>): {
  page: number; limit: number; skip: number;
} {
  const page = query.page ? Math.max(1, parseInt(query.page as string, 10)) : 1;
  const limit = query.limit ? Math.min(50, Math.max(1, parseInt(query.limit as string, 10))) : 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function formatProfile(profile: {
  id: string; name: string; gender: string;
  gender_probability: number; age: number; age_group: string;
  country_id: string; country_name: string; country_probability: number;
  created_at: Date;
}) {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    gender_probability: profile.gender_probability,
    age: profile.age,
    age_group: profile.age_group,
    country_id: profile.country_id,
    country_name: profile.country_name,
    country_probability: profile.country_probability,
    created_at: profile.created_at.toISOString(),
  };
}

// ─── GET /api/profiles ────────────────────────────────────────────────────────
export async function getProfiles(req: Request, res: Response): Promise<void> {
  const validationError = runValidation(req);
  if (validationError) {
    res.status(validationError.status).json({ status: "error", message: validationError.message });
    return;
  }

  try {
    const where = buildWhereClause(req.query);
    const orderBy = buildOrderBy(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const [total, data] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({ where, orderBy, skip, take: limit }),
    ]);

    const total_pages = Math.ceil(total / limit);
    const baseUrl = `/api/profiles`;
    const queryParams = buildQueryString(req.query, ["page", "limit"]);

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      total_pages,
      links: {
        self: `${baseUrl}?${queryParams}&page=${page}&limit=${limit}`,
        next: page < total_pages ? `${baseUrl}?${queryParams}&page=${page + 1}&limit=${limit}` : null,
        prev: page > 1 ? `${baseUrl}?${queryParams}&page=${page - 1}&limit=${limit}` : null,
      },
      data: data.map(formatProfile),
    });
  } catch (err) {
    console.error("getProfiles error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─── GET /api/profiles/search ─────────────────────────────────────────────────
export async function searchProfiles(req: Request, res: Response): Promise<void> {
  const q = req.query.q;

  if (!q || (typeof q === "string" && q.trim().length === 0)) {
    res.status(400).json({ status: "error", message: "Missing or empty parameter: q" });
    return;
  }

  if (typeof q !== "string") {
    res.status(422).json({ status: "error", message: "Invalid query parameters: q must be a string" });
    return;
  }

  const parsed = parseNaturalLanguageQuery(q);
  if (!parsed) {
    res.status(422).json({ status: "error", message: "Unable to interpret query" });
    return;
  }

  const paginationError = runPaginationValidation(req);
  if (paginationError) {
    res.status(paginationError.status).json({ status: "error", message: paginationError.message });
    return;
  }

  try {
    const where = buildWhereFromParsed(parsed);
    const { page, limit, skip } = buildPagination(req.query);

    const [total, data] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({ where, skip, take: limit, orderBy: { created_at: "asc" } }),
    ]);

    const total_pages = Math.ceil(total / limit);
    const baseUrl = `/api/profiles/search`;

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      total_pages,
      links: {
        self: `${baseUrl}?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
        next: page < total_pages ? `${baseUrl}?q=${encodeURIComponent(q)}&page=${page + 1}&limit=${limit}` : null,
        prev: page > 1 ? `${baseUrl}?q=${encodeURIComponent(q)}&page=${page - 1}&limit=${limit}` : null,
      },
      data: data.map(formatProfile),
    });
  } catch (err) {
    console.error("searchProfiles error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─── POST /api/profiles (admin only) ─────────────────────────────────────────
export async function createProfile(req: Request, res: Response): Promise<void> {
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ status: "error", message: "Name is required" });
    return;
  }

  const trimmedName = name.trim();

  const existing = await prisma.profile.findUnique({ where: { name: trimmedName } });
  if (existing) {
    res.status(409).json({ status: "error", message: "Profile with this name already exists" });
    return;
  }

  try {
    const [genderRes, ageRes, nationalizeRes] = await Promise.allSettled([
      axios.get(`https://api.genderize.io/?name=${encodeURIComponent(trimmedName)}`),
      axios.get(`https://api.agify.io/?name=${encodeURIComponent(trimmedName)}`),
      axios.get(`https://api.nationalize.io/?name=${encodeURIComponent(trimmedName)}`),
    ]);

    const genderData = genderRes.status === "fulfilled" ? genderRes.value.data : null;
    const ageData = ageRes.status === "fulfilled" ? ageRes.value.data : null;
    const nationalizeData = nationalizeRes.status === "fulfilled" ? nationalizeRes.value.data : null;

    const gender = genderData?.gender || "unknown";
    const gender_probability = genderData?.probability || 0;
    const age = ageData?.age || 0;
    const country = nationalizeData?.country?.[0] || { country_id: "UN", probability: 0 };
    const age_group = getAgeGroup(age);
    const country_name = getCountryName(country.country_id);

    const profile = await prisma.profile.create({
      data: {
        id: uuidv7(),
        name: trimmedName,
        gender,
        gender_probability,
        age,
        age_group,
        country_id: country.country_id,
        country_name,
        country_probability: country.probability,
      },
    });

    res.status(201).json({ status: "success", data: formatProfile(profile) });
  } catch (err) {
    console.error("createProfile error:", err);
    res.status(500).json({ status: "error", message: "Failed to create profile" });
  }
}

// ─── GET /api/profiles/export ─────────────────────────────────────────────────
export async function exportProfiles(req: Request, res: Response): Promise<void> {
  const format = req.query.format as string;

  if (!format || format !== "csv") {
    res.status(400).json({ status: "error", message: "format=csv is required" });
    return;
  }

  const validationError = runValidation(req);
  if (validationError) {
    res.status(validationError.status).json({ status: "error", message: validationError.message });
    return;
  }

  try {
    const where = buildWhereClause(req.query);
    const orderBy = buildOrderBy(req.query);
    const data = await prisma.profile.findMany({ where, orderBy });

    const headers = ["id","name","gender","gender_probability","age","age_group","country_id","country_name","country_probability","created_at"];
    const rows = data.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.gender,
      p.gender_probability,
      p.age,
      p.age_group,
      p.country_id,
      `"${p.country_name.replace(/"/g, '""')}"`,
      p.country_probability,
      p.created_at.toISOString(),
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="profiles_${timestamp}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error("exportProfiles error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─── GET /api/profiles/:id ────────────────────────────────────────────────────
export async function getProfileById(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ status: "error", message: "Profile not found" });
      return;
    }
    res.status(200).json({ status: "success", data: formatProfile(profile) });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}