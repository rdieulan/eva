import { ref } from 'vue';
import { ApiError } from '@/api/error';

/**
 * Composable for unified error handling in components
 * Provides state and functions to manage errors consistently
 */
export function useErrors() {
  const errors = ref<string[]>([]);

  /**
   * Set a single error message (for @error handlers)
   */
  function setError(message: string) {
    errors.value = [message];
  }

  /**
   * Set multiple errors at once (for validation results)
   */
  function setErrors(messages: string[]) {
    errors.value = messages;
  }

  /**
   * Set errors from a caught exception (for catch blocks)
   */
  function setErrorFromException(e: unknown, fallback: string) {
    if (e instanceof ApiError) {
      errors.value = e.errors;
    } else if (e instanceof Error) {
      errors.value = [e.message];
    } else {
      errors.value = [fallback];
    }
  }

  /**
   * Add an error to the list (for form validation)
   */
  function addError(message: string) {
    errors.value.push(message);
  }

  /**
   * Clear all errors
   */
  function clearErrors() {
    errors.value = [];
  }

  /**
   * Check if there are any errors
   */
  function hasErrors(): boolean {
    return errors.value.length > 0;
  }

  return {
    errors,
    setError,
    setErrors,
    setErrorFromException,
    addError,
    clearErrors,
    hasErrors,
  };
}
