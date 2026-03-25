package com.server.server.auth.google;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.server.server.auth.exception.AuthConfigurationException;
import com.server.server.auth.exception.InvalidCredentialsException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class GoogleIdentityVerifierService implements GoogleIdentityVerifier {

    private final String clientId;

    public GoogleIdentityVerifierService(@Value("${auth.google.client-id:}") String clientId) {
        this.clientId = clientId == null ? "" : clientId.trim();
    }

    @Override
    public GoogleUserProfile verify(String credential) {
        if (clientId.isBlank() || clientId.startsWith("replace-with-")) {
            throw new AuthConfigurationException("Google sign-in is not configured on the server.");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new InvalidCredentialsException("Google sign-in could not be verified.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();

            if (email == null || email.isBlank()) {
                throw new InvalidCredentialsException("Google account did not provide an email address.");
            }

            return new GoogleUserProfile(
                    payload.getSubject(),
                    email.trim().toLowerCase(Locale.ROOT),
                    Boolean.parseBoolean(String.valueOf(payload.getEmailVerified())),
                    (String) payload.get("name"),
                    (String) payload.get("picture"),
                    payload.getHostedDomain());
        } catch (GeneralSecurityException | IOException exception) {
            throw new AuthConfigurationException("Unable to validate Google sign-in right now.", exception);
        }
    }
}
