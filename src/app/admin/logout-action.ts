"use server";

import { redirect } from "next/navigation";
import { getAdminUser, destroyAdminSession } from "@/lib/auth";

export async function logoutAdmin() {
  const user = await getAdminUser();
  if (user) await destroyAdminSession(user.id);
  redirect("/admin/login");
}
