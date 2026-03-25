import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | PAF"
        description="Create a new account with your email and password."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
