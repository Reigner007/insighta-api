import { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { validateProfileQuery } from "../middleware/validate";
import { parseNaturalLanguageQuery } from "../services/queryParser";

const prisma = new PrismaClient();

// ─── GET /api/profiles ────────────────────────────────────────────────────────
export async function getProfiles(req: Request, res: Response): Promise<void> {
  // Run inline validation (reuse middleware logic directly for cleaner error flow)
  const validationError = runValidation(req);
  if (validationError) {
    res.status(validationError.status).json({
      status: "error",
      message: validationError.message,
    });
    return;
  }

  try {
    const where = buildWhereClause(req.query);
    const orderBy = buildOrderBy(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const [total, data] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: data.map(formatProfile),
    });
  } catch (err) {
    console.error("getProfiles error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─── GET /api/profiles/search ─────────────────────────────────────────────────
export async function searchProfiles(
  req: Request,
  res: Response
): Promise<void> {
  const q = req.query.q;

  if (!q || (typeof q === "string" && q.trim().length === 0)) {
    res.status(400).json({
      status: "error",
      message: "Missing or empty parameter: q",
    });
    return;
  }

  if (typeof q !== "string") {
    res.status(422).json({
      status: "error",
      message: "Invalid query parameters: q must be a string",
    });
    return;
  }

  const parsed = parseNaturalLanguageQuery(q);

  if (!parsed) {
    res.status(422).json({
      status: "error",
      message: "Unable to interpret query",
    });
    return;
  }

  // Validate pagination params if provided
  const paginationError = runPaginationValidation(req);
  if (paginationError) {
    res.status(paginationError.status).json({
      status: "error",
      message: paginationError.message,
    });
    return;
  }

  try {
    const where = buildWhereFromParsed(parsed);
    const { page, limit, skip } = buildPagination(req.query);

    const [total, data] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "asc" },
      }),
    ]);

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: data.map(formatProfile),
    });
  } catch (err) {
    console.error("searchProfiles error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhereClause(
  query: Record<string, unknown>
): Prisma.ProfileWhereInput {
  const where: Prisma.ProfileWhereInput = {};

  if (query.gender) where.gender = query.gender as string;
  if (query.age_group) where.age_group = query.age_group as string;
  if (query.country_id)
    where.country_id = (query.country_id as string).toUpperCase();

  // Age range
  const minAge = query.min_age !== undefined ? Number(query.min_age) : undefined;
  const maxAge = query.max_age !== undefined ? Number(query.max_age) : undefined;

  if (minAge !== undefined || maxAge !== undefined) {
    where.age = {};
    if (minAge !== undefined) where.age.gte = minAge;
    if (maxAge !== undefined) where.age.lte = maxAge;
  }

  // Probability filters
  if (query.min_gender_probability !== undefined) {
    where.gender_probability = {
      gte: Number(query.min_gender_probability),
    };
  }

  if (query.min_country_probability !== undefined) {
    where.country_probability = {
      gte: Number(query.min_country_probability),
    };
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

function buildOrderBy(
  query: Record<string, unknown>
): Prisma.ProfileOrderByWithRelationInput {
  const sortBy = (query.sort_by as string) || "created_at";
  const order = (query.order as "asc" | "desc") || "asc";

  return { [sortBy]: order };
}

function buildPagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = query.page ? Math.max(1, parseInt(query.page as string, 10)) : 1;
  const limit = query.limit
    ? Math.min(50, Math.max(1, parseInt(query.limit as string, 10)))
    : 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function formatProfile(profile: {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
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

// ─── Inline validators (mirror middleware for controller use) ─────────────────

interface ValidationError {
  status: number;
  message: string;
}

function runValidation(req: Request): ValidationError | null {
  const {
    gender,
    age_group,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
    page,
    limit,
  } = req.query;

  const VALID_GENDERS = ["male", "female"];
  const VALID_AGE_GROUPS = ["child", "teenager", "adult", "senior"];
  const VALID_SORT_BY = ["age", "created_at", "gender_probability"];
  const VALID_ORDERS = ["asc", "desc"];

  if (gender !== undefined && !VALID_GENDERS.includes(gender as string)) {
    return { status: 422, message: `Invalid query parameters: gender must be one of ${VALID_GENDERS.join(", ")}` };
  }
  if (age_group !== undefined && !VALID_AGE_GROUPS.includes(age_group as string)) {
    return { status: 422, message: `Invalid query parameters: age_group must be one of ${VALID_AGE_GROUPS.join(", ")}` };
  }
  if (min_age !== undefined) {
    const v = Number(min_age);
    if (isNaN(v) || !Number.isInteger(v) || v < 0)
      return { status: 422, message: "Invalid query parameters: min_age must be a non-negative integer" };
  }
  if (max_age !== undefined) {
    const v = Number(max_age);
    if (isNaN(v) || !Number.isInteger(v) || v < 0)
      return { status: 422, message: "Invalid query parameters: max_age must be a non-negative integer" };
  }
  if (min_age !== undefined && max_age !== undefined && Number(min_age) > Number(max_age)) {
    return { status: 422, message: "Invalid query parameters: min_age cannot be greater than max_age" };
  }
  if (min_gender_probability !== undefined) {
    const v = Number(min_gender_probability);
    if (isNaN(v) || v < 0 || v > 1)
      return { status: 422, message: "Invalid query parameters: min_gender_probability must be a float between 0 and 1" };
  }
  if (min_country_probability !== undefined) {
    const v = Number(min_country_probability);
    if (isNaN(v) || v < 0 || v > 1)
      return { status: 422, message: "Invalid query parameters: min_country_probability must be a float between 0 and 1" };
  }
  if (sort_by !== undefined && !VALID_SORT_BY.includes(sort_by as string)) {
    return { status: 422, message: `Invalid query parameters: sort_by must be one of ${VALID_SORT_BY.join(", ")}` };
  }
  if (order !== undefined && !VALID_ORDERS.includes(order as string)) {
    return { status: 422, message: `Invalid query parameters: order must be one of ${VALID_ORDERS.join(", ")}` };
  }
  if (page !== undefined) {
    const v = Number(page);
    if (isNaN(v) || !Number.isInteger(v) || v < 1)
      return { status: 422, message: "Invalid query parameters: page must be a positive integer" };
  }
  if (limit !== undefined) {
    const v = Number(limit);
    if (isNaN(v) || !Number.isInteger(v) || v < 1 || v > 50)
      return { status: 422, message: "Invalid query parameters: limit must be an integer between 1 and 50" };
  }

  return null;
}

function runPaginationValidation(req: Request): ValidationError | null {
  const { page, limit } = req.query;

  if (page !== undefined) {
    const v = Number(page);
    if (isNaN(v) || !Number.isInteger(v) || v < 1)
      return { status: 422, message: "Invalid query parameters: page must be a positive integer" };
  }
  if (limit !== undefined) {
    const v = Number(limit);
    if (isNaN(v) || !Number.isInteger(v) || v < 1 || v > 50)
      return { status: 422, message: "Invalid query parameters: limit must be an integer between 1 and 50" };
  }

  return null;
}