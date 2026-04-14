# PharmaTrace

PharmaTrace is a web-based medicine authentication system designed to help detect counterfeit pharmaceutical products. It allows users to verify the authenticity of a medicine by scanning a QR code printed on the product packaging.

The platform tracks medicine batches across the supply chain and checks whether a product has been previously scanned, activated by a vendor, or potentially duplicated.

## How it works

PharmaTrace provides a simple verification process:

1. A user opens the web application.
2. The user scans the QR code on a medicine package using the browser camera.
3. The system sends the scanned data to the backend.
4. The backend verifies the medicine using stored batch and unit records.
5. The application returns the verification result to the user.

The result can indicate whether the product is authentic, suspicious, or potentially counterfeit.

## Core Functions

- QR code scanning directly from the browser
- Medicine batch and unit verification
- Detection of repeated or abnormal scans
- Logging of scan events for tracking and analysis
- Secure backend verification using a database

## Purpose

The goal of PharmaTrace is to demonstrate how digital verification systems can improve transparency and safety in pharmaceutical distribution by helping users confirm that the medicines they receive are genuine.