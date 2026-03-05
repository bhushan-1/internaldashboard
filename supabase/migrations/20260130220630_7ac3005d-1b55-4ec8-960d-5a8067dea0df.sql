-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create user_accounts table for storing user/account data
CREATE TABLE public.user_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  additional_billing_emails TEXT[] DEFAULT '{}',
  api_key TEXT,
  app_name TEXT,
  cognito_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at_epoch BIGINT,
  email_verification_token TEXT,
  has_payment_problem BOOLEAN DEFAULT false,
  initial_company_name TEXT,
  initial_ip TEXT,
  initial_ip_info JSONB,
  is_admin_blocked BOOLEAN DEFAULT false,
  is_multi_free_trial_blocked BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT false,
  is_user_email_verified BOOLEAN DEFAULT false,
  plan_free_top_up_credits INTEGER DEFAULT 0,
  plan_id TEXT,
  plan_id_updated_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_mode TEXT,
  third_party_user_id TEXT,
  user_email TEXT,
  user_email_preferences_error BOOLEAN DEFAULT false,
  user_email_preferences_system BOOLEAN DEFAULT true,
  user_email_preferences_update BOOLEAN DEFAULT true,
  user_email_unsubscribe_token TEXT,
  user_release_notes_last_read_date BIGINT,
  user_user_name TEXT,
  previous_plan_id TEXT,
  stripe_customer JSONB DEFAULT '{}',
  current_period_end BIGINT,
  current_period_start BIGINT,
  on_yearly_plan BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- For admin/service access - allows authenticated users to read/write
CREATE POLICY "Allow authenticated read access" 
ON public.user_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" 
ON public.user_accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" 
ON public.user_accounts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete" 
ON public.user_accounts FOR DELETE TO authenticated USING (true);

-- Create indexes for common lookups
CREATE INDEX idx_user_accounts_user_id ON public.user_accounts(user_id);
CREATE INDEX idx_user_accounts_user_email ON public.user_accounts(user_email);
CREATE INDEX idx_user_accounts_api_key ON public.user_accounts(api_key);
CREATE INDEX idx_user_accounts_stripe_customer_id ON public.user_accounts(stripe_customer_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_accounts_updated_at
BEFORE UPDATE ON public.user_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();