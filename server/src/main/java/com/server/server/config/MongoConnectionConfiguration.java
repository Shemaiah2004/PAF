package com.server.server.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Configuration
@EnableConfigurationProperties(MongoConnectionProperties.class)
public class MongoConnectionConfiguration {

    private static final Logger logger = LoggerFactory.getLogger(MongoConnectionConfiguration.class);
    private static final Pattern MONGO_CREDENTIALS_PATTERN =
            Pattern.compile("^(mongodb(?:\\+srv)?://)([^/@:]+)(?::([^@]*))?@(.+)$");

    @Bean(destroyMethod = "close")
    public MongoClient mongoClient(
            MongoConnectionProperties mongoConnectionProperties) {
        String resolvedUri = resolveMongoUri(mongoConnectionProperties);
        ConnectionString connectionString = new ConnectionString(resolvedUri);

        MongoClientSettings settings = MongoClientSettings.builder()
                .applyConnectionString(connectionString)
                .applyToSocketSettings(socketSettings -> socketSettings
                        .connectTimeout(mongoConnectionProperties.getConnectTimeoutMs(), TimeUnit.MILLISECONDS))
                .applyToClusterSettings(clusterSettings -> clusterSettings
                        .serverSelectionTimeout(
                                mongoConnectionProperties.getServerSelectionTimeoutMs(),
                                TimeUnit.MILLISECONDS))
                .build();

        logger.info(
                "MongoDB client configured. uri='{}', database='{}'",
                redactConnectionString(resolvedUri),
                mongoConnectionProperties.getDatabase());

        return MongoClients.create(settings);
    }

    @Bean
    public ApplicationRunner mongoStartupCheck(
            MongoTemplate mongoTemplate,
            MongoConnectionProperties mongoConnectionProperties) {
        return args -> {
            String resolvedUri = resolveMongoUri(mongoConnectionProperties);

            try {
                Document pingResult = mongoTemplate.executeCommand(new Document("ping", 1));
                logger.info(
                        "MongoDB connection success. uri='{}', database='{}', ping='{}'",
                        redactConnectionString(resolvedUri),
                        mongoConnectionProperties.getDatabase(),
                        pingResult.get("ok"));
            } catch (Exception exception) {
                logger.error(
                        "MongoDB connection failure. uri='{}', database='{}'. Check MONGODB_URI or MONGODB_PASSWORD.",
                        redactConnectionString(resolvedUri),
                        mongoConnectionProperties.getDatabase(),
                        exception);
                throw new IllegalStateException(
                        "MongoDB startup check failed. Check MONGODB_URI or MONGODB_PASSWORD.",
                        exception);
            }
        };
    }

    static String resolveMongoUri(MongoConnectionProperties mongoConnectionProperties) {
        String uri = hasText(mongoConnectionProperties.getUri())
                ? mongoConnectionProperties.getUri().trim()
                : "mongodb://127.0.0.1:27017";
        String password = mongoConnectionProperties.getPassword();

        if (!hasText(password)) {
            return uri;
        }

        String encodedPassword = URLEncoder.encode(password.trim(), StandardCharsets.UTF_8)
                .replace("+", "%20");

        if (uri.contains("<password>")) {
            return uri.replace("<password>", encodedPassword);
        }

        if (uri.contains("${MONGODB_PASSWORD}")) {
            return uri.replace("${MONGODB_PASSWORD}", encodedPassword);
        }

        Matcher matcher = MONGO_CREDENTIALS_PATTERN.matcher(uri);
        if (!matcher.matches()) {
            return uri;
        }

        String existingPassword = matcher.group(3);
        if (hasText(existingPassword)
                && !existingPassword.contains("${")
                && !existingPassword.contains("<password>")
                && !existingPassword.contains("replace-with-")) {
            return uri;
        }

        return matcher.group(1) + matcher.group(2) + ":" + encodedPassword + "@" + matcher.group(4);
    }

    static String redactConnectionString(String uri) {
        return uri.replaceAll("://([^:@/]+):([^@]+)@", "://$1:***@");
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
