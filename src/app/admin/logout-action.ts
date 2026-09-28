"use server";

import { redirect } from "next/navigation";
import { destroyAdminSession } from "@/lib/auth";

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}
