import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/salir/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";

// #49: el layout de /admin manda acá cuando el back rechaza un token que el front acepta. Un Server
// Component no puede borrar cookies, y con la cookie viva proxy.ts rebota /login a /account/profile.
describe("GET /api/auth/salir", () => {
  it("borra la cookie de sesión y redirige a /login", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/salir", { headers: { cookie: `${AUTH_COOKIE_NAME}=viejo` } }),
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    const borrada = response.headers.getSetCookie().find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    expect(borrada).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=;`));
    expect(borrada).toMatch(/Max-Age=0/i);
  });
});
