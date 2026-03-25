import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | PAF"
        description="Sign in with your email and password to access the PAF dashboard."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
