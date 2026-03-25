package com.server.server.ticketing.service;

import com.server.server.exception.FileStorageException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path rootLocation;

    public FileStorageService(@Value("${ticket.storage.location}") String storageLocation) {
        this.rootLocation = Paths.get(storageLocation).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootLocation);
        } catch (IOException exception) {
            throw new FileStorageException("Unable to initialize ticket storage", exception);
        }
    }

    public List<String> storeTicketAttachments(Long ticketId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        if (files.size() > 3) {
            throw new FileStorageException("A maximum of 3 image attachments is allowed");
        }

        Path ticketDirectory = rootLocation.resolve(String.valueOf(ticketId)).normalize();
        try {
            Files.createDirectories(ticketDirectory);
        } catch (IOException exception) {
            throw new FileStorageException("Unable to create attachment directory", exception);
        }

        List<String> storedFiles = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file.isEmpty()) {
                continue;
            }
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new FileStorageException("Only image attachments are allowed");
            }

            String originalFileName = StringUtils.cleanPath(file.getOriginalFilename() == null
                    ? "attachment"
                    : file.getOriginalFilename());
            String extension = "";
            int extensionIndex = originalFileName.lastIndexOf('.');
            if (extensionIndex >= 0) {
                extension = originalFileName.substring(extensionIndex);
            }

            String generatedFileName = UUID.randomUUID() + extension;
            Path targetPath = ticketDirectory.resolve(generatedFileName).normalize();
            if (!targetPath.startsWith(ticketDirectory)) {
                throw new FileStorageException("Invalid attachment path");
            }

            try {
                Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException exception) {
                throw new FileStorageException("Failed to store attachment", exception);
            }

            storedFiles.add("/api/tickets/" + ticketId + "/attachments/" + generatedFileName);
        }

        return storedFiles;
    }

    public Resource loadAsResource(Long ticketId, String fileName) {
        try {
            Path filePath = rootLocation.resolve(String.valueOf(ticketId)).resolve(fileName).normalize();
            if (!filePath.startsWith(rootLocation)) {
                throw new FileStorageException("Invalid attachment path");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) {
                throw new FileStorageException("Attachment not found");
            }
            return resource;
        } catch (MalformedURLException exception) {
            throw new FileStorageException("Attachment could not be loaded", exception);
        }
    }
}
