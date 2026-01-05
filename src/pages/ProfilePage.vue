<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { user, token, clearAuth } = useAuth();

// Password change
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const passwordSuccess = ref('');
const isChangingPassword = ref(false);

// Change password
async function handleChangePassword() {
  passwordError.value = '';
  passwordSuccess.value = '';

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = 'Veuillez remplir tous les champs';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Les nouveaux mots de passe ne correspondent pas';
    return;
  }

  if (newPassword.value.length < 6) {
    passwordError.value = 'Le nouveau mot de passe doit faire au moins 6 caractères';
    return;
  }

  isChangingPassword.value = true;

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors du changement de mot de passe');
    }

    passwordSuccess.value = 'Mot de passe modifié avec succès';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe';
  } finally {
    isChangingPassword.value = false;
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
  } catch {
    // Ignore server-side logout errors
  } finally {
    clearAuth();
    router.push('/login');
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-container">
      <h1>Mon Profil</h1>

      <!-- User information -->
      <section class="profile-section" v-if="user">
        <h2>Informations</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>Nom</label>
            <span>{{ user.name }}</span>
          </div>
          <div class="info-item">
            <label>Email</label>
            <span>{{ user.email }}</span>
          </div>
          <div class="info-item">
            <label>Rôle</label>
            <span class="role-badge" :class="user.role.toLowerCase()">{{ user.role }}</span>
          </div>
        </div>
      </section>

      <!-- Password change -->
      <section class="profile-section">
        <h2>Changer le mot de passe</h2>
        <form @submit.prevent="handleChangePassword" class="password-form">
          <div class="form-group">
            <label for="currentPassword">Mot de passe actuel</label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <div class="form-group">
            <label for="newPassword">Nouveau mot de passe</label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le nouveau mot de passe</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <div v-if="passwordError" class="message error">
            {{ passwordError }}
          </div>

          <div v-if="passwordSuccess" class="message success">
            {{ passwordSuccess }}
          </div>

          <button type="submit" class="btn-primary" :disabled="isChangingPassword">
            {{ isChangingPassword ? 'Modification...' : 'Modifier le mot de passe' }}
          </button>
        </form>
      </section>

      <!-- Logout -->
      <section class="profile-section">
        <h2>Session</h2>
        <button class="btn-logout" @click="handleLogout">
          <svg viewBox="0 0 24 24" class="logout-icon">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          Se déconnecter
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  overflow-y: auto;
}

.profile-container {
  width: 100%;
  max-width: 600px;
}

h1 {
  color: #fff;
  margin: 0 0 2rem;
  font-size: 2rem;
  text-align: center;
}

.profile-section {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.profile-section h2 {
  color: #9a9ada;
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

/* User information */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item label {
  color: #888;
  font-size: 0.9rem;
}

.info-item span {
  color: #fff;
  font-weight: 500;
}

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.role-badge.admin {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.role-badge.player {
  background: rgba(122, 122, 186, 0.2);
  color: #9a9ada;
}

/* Password form */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #888;
  font-size: 0.9rem;
}

.form-group input {
  padding: 0.75rem 1rem;
  background: #1a1a2e;
  border: 2px solid #3a3a5a;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #7a7aba;
}

.form-group input::placeholder {
  color: #555;
}

.message {
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
}

.message.error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.message.success {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

.btn-primary {
  padding: 0.875rem;
  background: #7a7aba;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #9a9ada;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Logout button */
.btn-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem;
  background: transparent;
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  color: #ff6b6b;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: rgba(255, 107, 107, 0.1);
}

.logout-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
