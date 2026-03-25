package com.server.server.auth.google;

public interface GoogleIdentityVerifier {

    GoogleUserProfile verify(String credential);
}
