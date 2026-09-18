/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    adminUser?: import('./lib/adminAuth').UserSession;
    currentUser?: import('./lib/adminAuth').UserSession;
  }
}
