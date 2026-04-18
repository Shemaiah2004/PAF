package com.server.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mongodb")
public class MongoConnectionProperties {

    private String uri;
    private String password;
    private String database;
    private int connectTimeoutMs = 5000;
    private int serverSelectionTimeoutMs = 5000;

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDatabase() {
        return database;
    }

    public void setDatabase(String database) {
        this.database = database;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getServerSelectionTimeoutMs() {
        return serverSelectionTimeoutMs;
    }

    public void setServerSelectionTimeoutMs(int serverSelectionTimeoutMs) {
        this.serverSelectionTimeoutMs = serverSelectionTimeoutMs;
    }
}
