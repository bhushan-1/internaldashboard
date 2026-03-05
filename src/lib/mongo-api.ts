const API_BASE = "http://localhost:3001/api";

export interface MongoAccount {
  _id: string;
  userId: string;
  userEmail?: string;
  userUserName?: string;
  apiKey?: string;
  appName?: string;
  planId?: string;
  stripeCustomerId?: string;
  stripeCustomer?: string;
  stripeMode?: string;
  cognitoUserId?: string;
  thirdPartyUserId?: string;
  hasPaymentProblem?: boolean;
  isAdminBlocked?: boolean;
  isMultiFreeTrialBlocked?: boolean;
  isTestMode?: boolean;
  isUserEmailVerified?: boolean;
  onYearlyPlan?: boolean;
  planFreeTopUpCredits?: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  additionalBillingEmails?: string[];
  emailVerificationToken?: string;
  initialCompanyName?: string;
  initialIp?: string;
  initialIpInfo?: Record<string, unknown>;
  planIdUpdatedAt?: string;
  previousPlanId?: string;
  userEmailPreferencesError?: boolean;
  userEmailPreferencesSystem?: boolean;
  userEmailPreferencesUpdate?: boolean;
  userEmailUnsubscribeToken?: string;
  userReleaseNotesLastReadDate?: number;
  createdAt?: string;
  createdAtEpoch?: number;
  [key: string]: unknown;
}

export async function fetchAccounts(): Promise<MongoAccount[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch");
  return json.data;
}

export async function updateAccount(id: string, updates: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update");
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to delete");
}
