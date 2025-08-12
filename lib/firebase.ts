// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6E5Xn5RvZViYJW-hxh3pn8w1ALDZpOb4",
  authDomain: "vmh-tracker.firebaseapp.com",
  databaseURL: "https://vmh-tracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vmh-tracker",
  storageBucket: "vmh-tracker.appspot.com",
  messagingSenderId: "1036108389148",
  appId: "1:1036108389148:web:2add2da83a2759913138d9",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app)
export default app
