# Google OAuth Setup Instructions

To enable Google OAuth sign-in for your application, follow these steps:

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

## 2. Configure OAuth Consent Screen

1. In the Google Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Fill in the required fields:
   - **App name**: AI Study Helper (or your preferred name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add your app's domain under **Authorized domains**:
   - For development: Your Lovable preview URL domain
   - For production: Your deployed domain
5. Configure the following scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`

## 3. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials** and choose **OAuth Client ID**
3. Select **Web application** as the application type
4. Configure the following:

   **Authorized JavaScript origins:**
   - Add your site URL (e.g., `https://your-app.lovable.app`)
   - For local development: `http://localhost`

   **Authorized redirect URIs:**
   - You need to get the callback URL from your Lovable Cloud backend
   - The format is: `https://<PROJECT_ID>.supabase.co/auth/v1/callback`

5. Click **Create** and copy your:
   - Client ID
   - Client Secret

## 4. Configure in Lovable Cloud

1. Access your Lovable Cloud backend dashboard
2. Navigate to **Users > Auth Settings > Google Settings**
3. Enter your Google OAuth credentials:
   - **Client ID**: Paste from Google Cloud Console
   - **Client Secret**: Paste from Google Cloud Console
4. Save the settings

## 5. Important Notes

### Site URL and Redirect URLs
- Lovable Cloud automatically manages the Site URL and Redirect URL configuration
- If you deploy to a custom domain, add it in the Lovable Cloud dashboard under auth settings
- Make sure your redirect URL matches what's configured in Google Cloud Console

### Testing
- After configuration, test the Google sign-in button on your `/auth` page
- Users who sign in with Google will automatically get a profile created
- Default role is 'user'

### Troubleshooting

If you see an error like `"requested path is invalid"`:
- Check that your Site URL is correctly set in Lovable Cloud
- Verify the redirect URL in Google Cloud Console matches the callback URL
- Make sure the domain is authorized in both Google Cloud Console and Lovable Cloud

If Google OAuth button doesn't work:
- Verify Client ID and Client Secret are correctly entered
- Check browser console for errors
- Ensure the redirect URI is exactly as shown in Lovable Cloud
- Confirm all scopes are added in the consent screen

## Need Help?

For more detailed instructions, visit the [Supabase Google Auth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google).
