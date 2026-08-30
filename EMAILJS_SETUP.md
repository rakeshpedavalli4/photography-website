# EmailJS Setup Guide

## Complete Steps to Get Your Contact Form Working

### Step 1: Sign Up for EmailJS
1. Go to https://www.emailjs.com/
2. Click **Sign Up** → Create account with email
3. Verify your email address

### Step 2: Connect Gmail Account
1. In EmailJS Dashboard, go to **Email Services** (left sidebar)
2. Click **Add Service**
3. Select **Gmail**
4. Follow steps to authorize your Gmail account
5. **Copy your Service ID** (format: `service_xxxxxxxxx`)

### Step 3: Create Email Template
1. Go to **Email Templates** (left sidebar)
2. Click **Create New Template**
3. Fill in template as follows:

**Template Name:** Photography Contact Form
**Subject:** `New Message from {{from_name}}`

**Body:**
```
From: {{from_name}}
Email: {{from_email}}
Phone: {{phone}}
Subject: {{subject}}

Message:
{{message}}
```

4. **Copy your Template ID** (format: `template_xxxxxxxxx`)

### Step 4: Get Your Public Key
1. Click your **username** (top right)
2. Go to **Account** tab
3. **Copy Public Key** (format: `xxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 5: Update Your .env.local File
Open `.env.local` in your project and fill in:

```
VITE_EMAILJS_PUBLIC_KEY=paste_your_public_key_here
VITE_EMAILJS_SERVICE_ID=paste_your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=paste_your_template_id_here
```

### Step 6: Update Contact.jsx
In `src/components/Contact.jsx`, replace the top lines:

```javascript
import emailjs from '@emailjs/browser'

// Initialize EmailJS
emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY)
```

And in the `handleSubmit` function, replace:
```javascript
const result = await emailjs.send(
  import.meta.env.VITE_EMAILJS_SERVICE_ID,
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  // ... rest of the object
)
```

### Step 7: Test
1. Run `npm run dev`
2. Fill out the contact form
3. Click **Send Message**
4. Check your Gmail inbox for the message!

---

## Troubleshooting

**Q: Message says "Failed to send message"**
- Check that PUBLIC_KEY, SERVICE_ID, and TEMPLATE_ID are correct
- Make sure they're in `.env.local` (not `.env.example`)
- Verify your email template exists in EmailJS

**Q: "Service not found" error**
- Make sure you completed the Gmail authorization step
- Copy the exact Service ID from EmailJS dashboard

**Q: Email not arriving**
- Check your Gmail spam folder
- Verify the email template in EmailJS
- Test from EmailJS dashboard first (Email Services → Service Name → Test)

---

## Upgrade Options
EmailJS Free Tier: 200 emails/month
- Perfect for personal portfolios
- Upgrade to Pro for unlimited ($9.99/month)
