# GitHub SSH Key Setup Guide

This guide walks you through generating and configuring an SSH key on **Ubuntu (Native or WSL 2)** to authenticate with GitHub securely without entering passwords or tokens every time you push or pull code.

---

### Why Use SSH?

GitHub no longer accepts account passwords when authenticating Git operations. Using SSH keys allows your local computer to communicate with GitHub securely using public-key cryptography.

---

### Step 1: Configure Your Git Identity

Before generating keys, ensure Git knows your name and the email associated with your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "your_email@example.com"
```

Verify your configuration:
```bash
git config --global --list
```

---

### Step 2: Check for Existing SSH Keys

Check if you already have an SSH key pair generated:

```bash
ls -la ~/.ssh
```

If you see files named `id_ed25519` and `id_ed25519.pub` (or `id_rsa` and `id_rsa.pub`), you already have a key and can skip to **Step 4**. Otherwise, proceed to Step 3.

---

### Step 3: Generate a New SSH Key

We use the modern, highly secure **Ed25519** algorithm:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

> **Note:** Replace `"your_email@example.com"` with the email address registered with your GitHub account.

When prompted:
1. `Enter file in which to save the key (/home/.../.ssh/id_ed25519):`
   - Press **Enter** to accept the default location.
2. `Enter passphrase (empty for no passphrase):`
   - Press **Enter** for no passphrase, or enter a passphrase for extra security.
3. `Enter same passphrase again:`
   - Press **Enter** again.

Your key pair will be created:
- `~/.ssh/id_ed25519` (**Private key** — **NEVER share this file or paste it online!**)
- `~/.ssh/id_ed25519.pub` (**Public key** — This is what you upload to GitHub.)

---

### Step 4: Start SSH Agent & Add Your Key

Ensure the SSH agent is running in the background and register your private key:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

*Expected output:* `Identity added: /home/.../.ssh/id_ed25519 (your_email@example.com)`

---

### Step 5: Copy Your Public Key

Display your public key in the terminal:

```bash
cat ~/.ssh/id_ed25519.pub
```

The output starts with `ssh-ed25519` and ends with your email address:
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your_email@example.com
```

Select and copy the **entire line**, from `ssh-ed25519` to the end of your email address.

---

### Step 6: Add the SSH Key to GitHub

1. Open your browser and log into [GitHub](https://github.com).
2. Click your profile picture in the top-right corner $\rightarrow$ **Settings**.
3. In the left sidebar, click **SSH and GPG keys** (under "Access").
4. Click the green **New SSH key** button.
5. Fill in the fields:
   - **Title:** Give it a recognizable name (e.g., `WSL Ubuntu Laptop` or `Ubuntu Desktop`).
   - **Key type:** Leave as `Authentication Key`.
   - **Key:** Paste the public key string copied in Step 5.
6. Click **Add SSH key**. Confirm with your GitHub password or mobile authenticator if prompted.

---

### Step 7: Test Your Connection

Back in your Ubuntu terminal, verify that GitHub recognizes your key:

```bash
ssh -T git@github.com
```

> If you see a prompt like:
> ```text
> The authenticity of host 'github.com (...)' can't be established.
> ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zVQ6NxQhECW5...
> Are you sure you want to continue connecting (yes/no/[fingerprint])?
> ```
> Type **`yes`** and hit **Enter**.

*Expected output:*
```text
Hi <your-username>! You've successfully authenticated, but GitHub does not provide shell access.
```

If you see this message, your SSH setup is complete and fully functional!

---

### Step 8: Working with Repositories via SSH

#### Cloning a repository with SSH:
Always copy the **SSH** URL (`git@github.com:...`) instead of the HTTPS URL:
```bash
git clone git@github.com:Mo-Elshamy/Smart_EV_Kit_2.git
```

#### Switching an existing cloned repository from HTTPS to SSH:
If you previously cloned a repo using HTTPS, change its remote URL to SSH so you don't get asked for passwords:

```bash
# Check your current remote URL
git remote -v

# Switch to SSH
git remote set-url origin git@github.com:Mo-Elshamy/Smart_EV_Kit_2.git

# Verify it was updated
git remote -v
```

---

### Troubleshooting & Common Issues

| Issue / Error | Cause | Solution |
|---|---|---|
| `Permission denied (publickey)` | The key has not been added to GitHub, or ssh-agent does not have the key loaded. | Run `ssh-add ~/.ssh/id_ed25519` and verify the key in GitHub Settings $\rightarrow$ SSH Keys. |
| `Could not open a connection to your authentication agent.` | `ssh-agent` is not running. | Run `eval "$(ssh-agent -s)"` before running `ssh-add`. |
| Pushing asks for `Username for 'https://github.com'` | The repository remote is set to HTTPS instead of SSH. | Run `git remote set-url origin git@github.com:<owner>/<repo>.git`. |
| Accidental private key upload | Uploaded `id_ed25519` instead of `id_ed25519.pub`. | Delete the key from GitHub immediately, generate a new pair, and ensure you only upload the file ending in `.pub`. |
