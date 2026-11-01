import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { isSeller } from "@/lib/server/seller-auth";
import { passwordAuthConfigured } from "@/lib/server/seller-session";
import Link from "next/link";
import SellerDashboard from "./seller-dashboard";
import SellerLogin from "./seller-login";

export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const user = await getChatGPTUser();
  if (!user && passwordAuthConfigured()) return <SellerLogin />;
  if (!user) return <main className="seller-gate"><div><Link className="gate-brand" href="/">Kawan, Makan Lah!</Link><h1>Seller sign in</h1><p>Sign in with an approved seller account to manage orders.</p><a className="gate-button" href={chatGPTSignInPath("/seller")} target="_top">Sign in</a></div></main>;
  const signOutPath = user.authProvider === "password"
    ? "/api/seller/session"
    : chatGPTSignOutPath("/seller");
  if (!isSeller(user)) return <main className="seller-gate"><div><Link className="gate-brand" href="/">Kawan, Makan Lah!</Link><h1>No seller access</h1><p>This account is not on the seller list.</p><a className="gate-button" href={signOutPath} target="_top">Switch account</a></div></main>;
  return <SellerDashboard sellerEmail={user.email} signOutPath={signOutPath} />;
}
