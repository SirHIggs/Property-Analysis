# Switching on accounts

Accounts are built but off. They switch on when `SUPABASE_URL` and `SUPABASE_KEY` are set in `build.js`. Until then the site works exactly as before: deals stay in each visitor's browser, and the page can't connect anywhere.

Allow about an hour for the whole setup. Do the steps in order.

## 1. Create the Supabase project (about 15 minutes)

1. Go to supabase.com and sign up with **admin@buyboxsa.co.za**. Turn on two-factor authentication under your account settings.
2. Create a new project:
   - **Name:** `buy-box`.
   - **Database password:** generate a long one and keep it in your password manager. The site never uses it.
   - **Region:** an EU region, such as Frankfurt (eu-central-1) or Ireland (eu-west-1). The privacy notice says "European Union".
   - **Plan:** Free.
3. Wait for the project to finish setting up (a minute or two).

On the Free plan, a project with no activity for about a week is paused. Once testers use the site, this shouldn't happen. If it does, open the project in Supabase and click **Restore**.

## 2. Create the tables (5 minutes)

1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of `supabase/schema.sql` from this repository and click **Run**. It should say "Success. No rows returned".
3. Check **Table Editor**: `deals`, `profiles` and `settings` are listed, each marked with RLS enabled.

## 3. Sign-in settings (5 minutes)

**Authentication → Sign In / Providers → Email:**
- Email sign-in: on.
- **Confirm email:** on, so people prove they own the address.
- **Minimum password length:** 10 (the site asks for 10 too).

**Authentication → URL Configuration:**
- **Site URL:** `https://buyboxsa.co.za`
- **Redirect URLs:** add `https://buyboxsa.co.za/**`

## 4. Sending emails from noreply@ through Resend (about 20 minutes)

Supabase's built-in email only reaches the members of your Supabase team, so testers wouldn't get confirmation emails. Resend's free plan sends up to 3,000 emails a month.

1. Sign up at resend.com with **admin@buyboxsa.co.za**.
2. **Domains → Add domain:** enter `buyboxsa.co.za` and choose the region **Ireland (eu-west-1)**.
3. Resend shows about three DNS records (an MX and a TXT on a `send` subdomain, and a DKIM TXT at `resend._domainkey`). Add each one at Domains.co.za, the same way you added Zoho's records. Remember that Domains.co.za wants the full name, e.g. `send.buyboxsa.co.za` and `resend._domainkey.buyboxsa.co.za`. These sit on their own subdomains, so they don't clash with Zoho's MX and SPF records.
4. Click **Verify** in Resend (it can take up to an hour).
5. **API Keys → Create API key:** permission "Sending access", domain `buyboxsa.co.za`. Copy it. **Don't send it to anyone, including me.** It goes straight into Supabase in the next step.
6. In Supabase, go to **Authentication → Emails → SMTP Settings** and turn on custom SMTP:
   - Sender email: `noreply@buyboxsa.co.za`
   - Sender name: `Buy Box`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key
7. Under **Authentication → Rate Limits**, raise "emails per hour" to about 30.

Optional: under **Authentication → Emails → Templates**, edit the wording.
- **Confirm signup:**
  - subject "Confirm your Buy Box account";
  - body "Click to confirm your email and finish creating your free Buy Box account:", followed by the confirmation link that's already in the template.
- **Reset password:**
  - subject "Reset your Buy Box password";
  - body "Someone (hopefully you) asked to reset your Buy Box password. Click to choose a new one:", followed by the link. End with "If you didn't ask, ignore this email."

## 5. Send me two values (2 minutes)

From **Project Settings → API Keys** (or **API**), send:

1. the **Project URL**, for example `https://abcdefghijkl.supabase.co`;
2. the **publishable key** (starts with `sb_publishable_`), or the legacy **anon** key if that's what's shown.

Both are safe to share: they are public by design and end up in the website's code. **Never send the secret or `service_role` key.** build.js refuses to build with one.

I set them in `build.js`, run the tests and open a pull request. When you merge it, accounts go live.

## 6. Make yourself the owner (2 minutes, after accounts are live)

1. On https://buyboxsa.co.za, go to **Account → Create account** with the email you want as the owner, and confirm it from your inbox.
2. In Supabase **SQL Editor**, run this with your email:

   ```sql
   update public.profiles set role = 'owner'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Reload the site. **Video mode** appears in the sidebar and on your Account page. Nobody else sees it, and nobody can make themselves owner from the site.

## 7. POPIA housekeeping (recommended)

- Register yourself as the Information Officer with the Information Regulator: the eServices portal on inforegulator.org.za. It's free.
- Keep privacy@buyboxsa.co.za monitored: the privacy notice promises replies within 30 days.

## Checking it works

- Create an account on the site with a second email address, confirm it and sign in.
- Save a deal, then sign in on your phone: the deal should be there.
- Use **Forgot password?**: the email should come from noreply@buyboxsa.co.za.
- In Supabase **Table Editor → deals**, rows appear per account. **Authentication → Users** lists the accounts.
- Delete the test account under **Account → Delete account**: it disappears from Users, and its deals go with it.
