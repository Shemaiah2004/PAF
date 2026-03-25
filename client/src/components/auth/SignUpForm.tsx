import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import LoadingIndicator from "../common/LoadingIndicator";
import { useNotification } from "../common/NotificationProvider";
import {
  authApiBaseUrl,
  getApiMessage,
  parseResponsePayload,
} from "../../lib/auth";

type FormData = {
  email: string;
  password: string;
};

type FormErrors = {
  email?: string;
  password?: string;
};

const initialFormData: FormData = {
  email: "",
  password: "",
};

export default function SignUpForm() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!formData.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }

    if (!formData.password) {
      nextErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setServerError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const trimmedEmail = formData.email.trim();

    try {
      const response = await fetch(`${authApiBaseUrl}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: formData.password,
        }),
      });

      const rawResponse = await response.text();
      const payload = parseResponsePayload<{ message?: string }>(rawResponse);

      if (!response.ok) {
        const message = getApiMessage(
          payload,
          "Unable to create your account right now."
        );
        setServerError(message);
        showNotification({
          variant: "error",
          title: "Sign-up failed",
          message,
        });
        return;
      }

      const message = getApiMessage(
        payload,
        "Account created successfully. Sign in with your new account."
      );
      setFormData(initialFormData);
      setErrors({});
      setShowPassword(false);
      showNotification({
        variant: "success",
        title: "Account created",
        message,
      });
      navigate("/signin", {
        replace: true,
        state: {
          email: trimmedEmail,
        },
      });
    } catch {
      const message =
        "Cannot reach the server. Make sure Spring Boot is running.";
      setServerError(message);
      showNotification({
        variant: "error",
        title: "Sign-up failed",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign Up
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create your account with just your email and password.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <Label htmlFor="email">
                  Email<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  error={Boolean(errors.email)}
                  hint={errors.email}
                />
              </div>

              <div>
                <Label htmlFor="password">
                  Password<span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={(event) =>
                      handleChange("password", event.target.value)
                    }
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    error={Boolean(errors.password)}
                    hint={errors.password}
                  />
                  <span
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </span>
                </div>
              </div>

              {serverError ? (
                <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                  {serverError}
                </div>
              ) : null}

              <div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={isSubmitting}
                  startIcon={
                    isSubmitting ? (
                      <LoadingIndicator size="sm" tone="inverse" />
                    ) : undefined
                  }
                >
                  {isSubmitting ? "Creating account" : "Sign Up"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Already have an account?{" "}
              <Link
                to="/signin"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
