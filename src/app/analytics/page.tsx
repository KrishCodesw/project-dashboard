"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ui/ThemeToggle";
import FloatingPillNavbar from "@/components/ui/ShowCaseNavbar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Users,
  FolderKanban,
  GraduationCap,
  Lightbulb,
  Target,
  Award,
  Layers,
  Briefcase,
  Search,
  X,
  Filter,
  ChevronDown,
} from "lucide-react";

import beProjectsRaw from "../majorprojects/BE_NBA_groups.json";
const beProjects = beProjectsRaw as any[];

const rblGroups = [
  {
    groupId: "A1",
    guide: "Mr. Loukik Salvi",
    title:
      "On-device semantic segmentation of WMS services with geospatial data export",
    students: [
      { rollNo: 1, name: "Deepanshu Aggarwal" },
      { rollNo: 9, name: "Gatik Arora" },
      { rollNo: 23, name: "Choudhary Shamim Ayub Sakko" },
    ],
  },
  {
    groupId: "A2",
    guide: "Dr. R.R. Sedamkar/ Co Guide: Mrs. Siddhi Ambre",
    title: "IOT based Smart bottle for Healthcare",
    students: [
      { rollNo: 40, name: "Khushi Dwivedi" },
      { rollNo: 61, name: "Sakshi Gupta" },
    ],
  },
  {
    groupId: "A3",
    guide: "Mr. Vikas Singh",
    title:
      "Implementation of an Alumni Association Platform for a University/Institute",
    students: [
      { rollNo: 51, name: "Aayush Gupta" },
      { rollNo: 59, name: "Ritesh Gupta" },
      { rollNo: 68, name: "Jha Prince satan" },
    ],
  },
  {
    groupId: "A4",
    guide: "Dr. Rashmi Thakur",
    title: "College Event Management App",
    students: [
      { rollNo: 52, name: "Gupta Aman" },
      { rollNo: 71, name: "Varun Parmar" },
      { rollNo: 49, name: "Prem Gowda" },
    ],
  },
  {
    groupId: "A5",
    guide: "Dr. Harshali Patil",
    title: "AI-Enhanced Internship Management Portal",
    students: [
      { rollNo: 66, name: "Sonali bind" },
      { rollNo: 67, name: "Geetanjali Ramakant Dhanwade" },
      { rollNo: 69, name: "Shivani Sunil Kamde" },
    ],
  },
  {
    groupId: "A6",
    guide: "Ms. Abhilasha Patil",
    title: "Multi-agent AI assistant",
    students: [
      { rollNo: 25, name: "Hitansh Dedhia" },
      { rollNo: 43, name: "Krishna Gangwal" },
      { rollNo: 57, name: "khushi gupta" },
    ],
  },
  {
    groupId: "A7",
    guide: "Dr. Vaishali Nirgude",
    title: "Multi-Agent AI SaaS Platform for Intelligent Workflow Management",
    students: [
      { rollNo: 10, name: "Tarun Asthana" },
      { rollNo: 53, name: "KARAN DURGESH GUPTA" },
      { rollNo: 58, name: "Parth Gupta" },
    ],
  },
  {
    groupId: "A8",
    guide: "Mrs. Akshata Raut",
    title:
      "Intelligent College Event Management System for Student Activity Credits",
    students: [
      { rollNo: 20, name: "Nidhay Chavan" },
      { rollNo: 44, name: "Gaurav Gautam" },
      { rollNo: 48, name: "Aryan Goud" },
    ],
  },
  {
    groupId: "A9",
    guide: "Dr. Megharani Patil",
    title: "Carbon Credit Tracking System",
    students: [
      { rollNo: 50, name: "Vedika Gugale" },
      { rollNo: 62, name: "Ayush Gusain" },
      { rollNo: 63, name: "Hith Jodhavat" },
    ],
  },
  {
    groupId: "A10",
    guide: "Dr. Sheetal Rathi/ Co Guide: Ms. Sonali Gandhi",
    title: "AI supported Aicte approval portal",
    students: [
      { rollNo: 21, name: "Pranjal Chavan" },
      { rollNo: 55, name: "Kashish Gupta" },
      { rollNo: 56, name: "Khushboo Gupta" },
    ],
  },
  {
    groupId: "A11",
    guide: "Dr. Harshali Patil",
    title: "ESPVault: Secure Password Manager for ESP8266",
    students: [
      { rollNo: 13, name: "Rashi Bedse" },
      { rollNo: 24, name: "Kruti Dagade" },
      { rollNo: 26, name: "Gaurav Desai" },
    ],
  },
  {
    groupId: "A12",
    guide: "Dr. Rekha Sharma",
    title: "Personalized Expense Tracker App using OCR and NLP",
    students: [
      { rollNo: 4, name: "Dev Ahir" },
      { rollNo: 17, name: "Harshit Chaube" },
      { rollNo: 47, name: "Shawn Gonsalves" },
    ],
  },
  {
    groupId: "A13",
    guide: "Mr. Ashish Dwivedi",
    title: "Cryptocurrency crime analysis & transaction tracking",
    students: [
      { rollNo: 42, name: "Niel Gajera" },
      { rollNo: 70, name: "Shubham mondal" },
    ],
  },
  {
    groupId: "A14",
    guide: "Dr. Shailesh Sangle",
    title: "Emergency Response App with Location Sharing",
    students: [
      { rollNo: 3, name: "Aparna Agrawal" },
      { rollNo: 8, name: "Sana Ansari" },
      { rollNo: 27, name: "Saniya Desai" },
    ],
  },
  {
    groupId: "A15",
    guide: "Ms. Sonali Gandhi",
    title: "Simplifying Access to Government Digital Services",
    students: [
      { rollNo: 41, name: "Sonakshi Dwivedi" },
      { rollNo: 64, name: "Kaustubh Alshi" },
      { rollNo: 65, name: "Ansari Asadullah Azim" },
    ],
  },
  {
    groupId: "A16",
    guide: "Dr. Shailesh Sangle",
    title: "Energy Monitoring System for Commercial Buildings",
    students: [
      { rollNo: 6, name: "Vedant Anand" },
      { rollNo: 22, name: "Chirag Ralhan" },
      { rollNo: 34, name: "Drivyaansh Yadav" },
    ],
  },
  {
    groupId: "A17",
    guide: "Ms. Hetal Rana",
    title: "Visual Analytics Dashboard for Breaking Down Data Silos",
    students: [
      { rollNo: 11, name: "Asmit Bagkar" },
      { rollNo: 28, name: "Uday" },
      { rollNo: 29, name: "Premraj Dhondphode" },
    ],
  },
  {
    groupId: "A18",
    guide: "Ms. Foram Shah",
    title: "An Automated Diagnosis agent.",
    students: [
      { rollNo: 14, name: "Shreevathsa Bhat" },
      { rollNo: 7, name: "Jai Anjaria" },
      { rollNo: 12, name: "Hardik Bansal" },
    ],
  },
  {
    groupId: "A19",
    guide: "Mrs. Foram Shah",
    title:
      "Institute-Level Examination Management and Result Automation System",
    students: [
      { rollNo: 54, name: "Karan Gupta" },
      { rollNo: 60, name: "Rohit Gupta" },
      { rollNo: 46, name: "Shivam Giri" },
    ],
  },
  {
    groupId: "A20",
    guide: "Mr. Swapnil Bhagat",
    title: "Lip2Text : A system that can Lipread",
    students: [
      { rollNo: 39, name: "Abhinav Dwivedi" },
      { rollNo: 38, name: "Disha Dungrani" },
      { rollNo: 37, name: "Pragnesh Dubey" },
      { rollNo: 32, name: "Divesh gawkar" },
    ],
  },
  {
    groupId: "A21",
    guide: "Ms. Drashti Shrimal",
    title: "LearnLoop : Progress driven learning platform",
    students: [
      { rollNo: 31, name: "Disha Nayak" },
      { rollNo: 18, name: "Gayathri Chauhan" },
      { rollNo: 16, name: "Aabha Chaube" },
    ],
  },
  {
    groupId: "A22",
    guide: "Ms. Foram Shah",
    title: "TCETian - Your CampusConnection Hub",
    students: [
      { rollNo: 35, name: "Aayush Dubey" },
      { rollNo: 36, name: "Aayush Dubey" },
      { rollNo: 45, name: "Ritesh Gautam" },
    ],
  },
  {
    groupId: "A23",
    guide: "Mr. Swapnil Bhagat",
    title:
      "Efficient Web development design for reduce processing latency & fault isolation",
    students: [
      { rollNo: 5, name: "Tanish Akre" },
      { rollNo: 15, name: "Riddam Bokdia" },
      { rollNo: 30, name: "Dhrumi Modi" },
    ],
  },
  {
    groupId: "A24",
    guide: "Mr. Ashish Dwivedi",
    title:
      "Intelligent Shared Inbox for Automated Customer Support Ticket Management",
    students: [
      { rollNo: 2, name: "Kavya Aggarwal" },
      { rollNo: 33, name: "Shivam Donda" },
      { rollNo: 19, name: "Rajdeep Chauhan" },
    ],
  },
  {
    groupId: "B1",
    guide: "Dr. Megharani Patil",
    title:
      "An Autonomous driven Infused Cognitive Marketplace with Multi-Modal for Peer-to-Peer Sharing of Books",
    students: [
      { rollNo: 37, name: "Yash Pandey" },
      { rollNo: 44, name: "Anjali Prajapati" },
      { rollNo: 49, name: "Arpit Rai" },
    ],
  },
  {
    groupId: "B2",
    guide: "Mrs. Veena Kulkarni",
    title: "Unified Tutor Discovery and Student Progress Tracking Platform",
    students: [
      { rollNo: 51, name: "Harshit Rai" },
      { rollNo: 58, name: "Varad Umesh Sathe" },
      { rollNo: 61, name: "Farhan Shaikh" },
    ],
  },
  {
    groupId: "B3",
    guide: "Dr. Preksha Pareek",
    title: "AI-Powered Criminal Identification System Using Facial Recognition",
    students: [
      { rollNo: 38, name: "Sonam parmar" },
      { rollNo: 41, name: "Mukta Prashant Phirke" },
      { rollNo: 40, name: "Aarya Patel" },
    ],
  },
  {
    groupId: "B4",
    guide: "Ms. Deepali Joshi",
    title: "AI-Powered Resume Screener using NLP",
    students: [
      { rollNo: 50, name: "Dipeshwar kumar Rai" },
      { rollNo: 57, name: "Atharva Sasane" },
      { rollNo: 59, name: "Manas Sawant" },
    ],
  },
  {
    groupId: "B5",
    guide: "Ms. Pratiksha Deshmukh",
    title: "Multilingual virtual meeting",
    students: [
      { rollNo: 30, name: "Anuj Mahesh Pal" },
      { rollNo: 33, name: "Pratik Sandeep Pandey" },
      { rollNo: 35, name: "Saurabh Pandey" },
    ],
  },
  {
    groupId: "B6",
    guide: "Dr. Rekha Sharma",
    title: "AI driven Mental Health Tracking using Digital Activity Patterns",
    students: [
      { rollNo: 52, name: "Vivek Rai" },
      { rollNo: 54, name: "Shreya Rajput" },
      { rollNo: 63, name: "Shivani Niranjan Shanbhag" },
    ],
  },
  {
    groupId: "B7",
    guide: "Ms. Deepali Joshi",
    title:
      "Software-Centric Vehicle CO₂ Emission Monitoring and Analysis System",
    students: [
      { rollNo: 42, name: "Prabhukeluskar Akhila Nandkishor" },
      { rollNo: 43, name: "Shivangi Pradhan" },
      { rollNo: 48, name: "Noah Punnen" },
    ],
  },
  {
    groupId: "B8",
    guide: "Dr. Megharani Patil",
    title: "Decentralized, Secure Community Hubs for Last-Mile Delivery",
    students: [
      { rollNo: 10, name: "Vishal Kanojiya" },
      { rollNo: 13, name: "Mohammed Zeeshan Katheem" },
      { rollNo: 34, name: "Pandey Rahul Rakesh Kumud" },
    ],
  },
  {
    groupId: "B9",
    guide: "Mr. Vikas Singh",
    title: "BharatLink X: AI-Powered Hyperlocal Immersive Marketplace",
    students: [
      { rollNo: 5, name: "Adarsh Jha" },
      { rollNo: 27, name: "Mourya Vishal Rampyare" },
      { rollNo: 36, name: "Shivam Pankaj Pandey" },
    ],
  },
  {
    groupId: "B10",
    guide: "Dr. Rashmi Thakur",
    title: "Stock market app",
    students: [
      { rollNo: 46, name: "Akshat Prasad" },
      { rollNo: 47, name: "Rishabh Praveen" },
      { rollNo: 60, name: "Raj Uday Sawant" },
    ],
  },
  {
    groupId: "B11",
    guide: "Dr. Preksha Pareek",
    title: "FacePay: a secure facial-recognition-based payment system",
    students: [
      { rollNo: 66, name: "Prince Maurya" },
      { rollNo: 67, name: "Urvashi Mehta" },
      { rollNo: 70, name: "Shreya Manoj Palande" },
    ],
  },
  {
    groupId: "B12",
    guide: "Dr. Preksha Pareek",
    title: "LeafCare: AI-Powered Plant Disease Detection",
    students: [
      { rollNo: 65, name: "Aaryan Koradia" },
      { rollNo: 68, name: "Harsh Mishra" },
      { rollNo: 69, name: "Lalitkumar Mourya" },
    ],
  },
  {
    groupId: "B13",
    guide: "Dr. Shailesh Sangle",
    title:
      "SMART-COST: A Project Cost Estimator for Software Development Teams",
    students: [
      { rollNo: 6, name: "Hrishikesh Jha" },
      { rollNo: 23, name: "Aryaman Mathur" },
      { rollNo: 26, name: "Shlok Sanjeev Mishra" },
    ],
  },
  {
    groupId: "B14",
    guide: "Ms. Mimansha Singh",
    title: "Smart Traffic Signal Optimization System",
    students: [
      { rollNo: 4, name: "Anmol Jawalia" },
      { rollNo: 25, name: "Aditya Mishra" },
      { rollNo: 32, name: "Rohan Krishnakant Palav" },
    ],
  },
  {
    groupId: "B15",
    guide: "Mrs. Lydia Suganya",
    title: "Personalized Learning Gap",
    students: [
      { rollNo: 14, name: "Rumit Pravin Khabale" },
      { rollNo: 28, name: "Nitin Sharma" },
      { rollNo: 62, name: "Nawaz Shaikh" },
    ],
  },
  {
    groupId: "B16",
    guide: "Mrs. Lydia Suganya",
    title: "Travel Planner",
    students: [
      { rollNo: 15, name: "Sarang Kini" },
      { rollNo: 16, name: "Shreyash Kolhe" },
      { rollNo: 20, name: "Tanish Nilesh Macharla" },
    ],
  },
  {
    groupId: "B17",
    guide: "Dr. Sheetal Rathi/ Co Guide: Ms. Akshata Raut",
    title: "Cre8Flow: A Digital Platform for Creator-Based Event Booking",
    students: [
      { rollNo: 2, name: "Neha Jain" },
      { rollNo: 3, name: "Somil jaiswal" },
      { rollNo: 39, name: "Sujit Parmar" },
    ],
  },
  {
    groupId: "B18",
    guide: "Mr. Vikas Singh",
    title: "Recyclopedia Website",
    students: [
      { rollNo: 9, name: "Karan kami" },
      { rollNo: 21, name: "Yash Sunil Mane" },
      { rollNo: 31, name: "PAL ARYAN VIJAY BAHADUR" },
    ],
  },
  {
    groupId: "B19",
    guide: "Dr. Harshali Patil",
    title: "AI-Powered Personalized Storytelling for Kids",
    students: [
      { rollNo: 17, name: "Arpita Arvind Singh Kshatriya" },
      { rollNo: 18, name: "Prerit kumar" },
      { rollNo: 24, name: "Ankita Maurya" },
    ],
  },
  {
    groupId: "B20",
    guide: "Dr. Vaishali Nirgude",
    title: "Smart Irrigation Scheduler using Weather Forecast API",
    students: [
      { rollNo: 8, name: "Vivek Joshi" },
      { rollNo: 12, name: "HarshVardhan Kashyap" },
      { rollNo: 22, name: "Aasim Mapkar" },
    ],
  },
  {
    groupId: "B21",
    guide: "Ms. Tarunima Mukherjee",
    title: "Yqueue: A Web-Based Queue-Less Self-Checkout System",
    students: [
      { rollNo: 29, name: "Nivin reshith" },
      { rollNo: 19, name: "Manav kumbhar" },
      { rollNo: 55, name: "Heet R" },
    ],
  },
  {
    groupId: "B22",
    guide: "Ms. Tanmayi Nagale",
    title: "Enterprise multi-tenant SaaS POS Application",
    students: [
      { rollNo: 45, name: "Sujit Prajapati" },
      { rollNo: 56, name: "Vibhav Salian" },
      { rollNo: 53, name: "Sankalp Rajbhar" },
    ],
  },
  {
    groupId: "B23",
    guide: "Ms. Tarunima Mukherjee",
    title: "Real Estate Valuation System",
    students: [
      { rollNo: 1, name: "Shreya Jadhav" },
      { rollNo: 7, name: "Jeenesh Joshi" },
      { rollNo: 64, name: "Ashmeet Sharma" },
      { rollNo: 11, name: "Nilakshi Kar" },
    ],
  },
  {
    groupId: "C1",
    guide: "Ms. Pratiksha D",
    title: "AI Powered Corruption Detection System using NLP",
    students: [
      { rollNo: 45, name: "Sakshi Varma" },
      { rollNo: 46, name: "Tanvi" },
      { rollNo: 71, name: "Yadav kumariroshani premkumar" },
    ],
  },
  {
    groupId: "C2",
    guide: "Ms Deepali J",
    title: "Voice Based Stock Market Assistant for Retail Investors",
    students: [
      { rollNo: 9, name: "Akash Singh" },
      { rollNo: 26, name: "Kushagra Srivastava" },
      { rollNo: 43, name: "Unnat Malik" },
    ],
  },
  {
    groupId: "C3",
    guide: "Ms. Loukik S",
    title: "SOMA : A unified motion capture & style transfer pipeline",
    students: [
      { rollNo: 7, name: "Abhinav Singh" },
      { rollNo: 54, name: "Aryan Yadav" },
      { rollNo: 66, name: "Chinmay Sawant" },
    ],
  },
  {
    groupId: "C4",
    guide: "Mrs. Siddhi Ambre",
    title: "AI based drone movement monitoring & collision avoidance system",
    students: [
      { rollNo: 41, name: "UJJESHA TIWARI" },
      { rollNo: 49, name: "Snehaal Vishwakarma" },
      { rollNo: 61, name: "Trisha Yadav" },
    ],
  },
  {
    groupId: "C5",
    guide: "Dr.Rekha Sharma",
    title: "WealthSync: Investment tracking and ITR filing",
    students: [
      { rollNo: 3, name: "Rishi Sharma" },
      { rollNo: 16, name: "Rajveer Singh" },
      { rollNo: 20, name: "Souvik Singh" },
    ],
  },
  {
    groupId: "C6",
    guide: "Dr. Sheetal Rathi/ Co guide: Ms Hetal Rana",
    title: "AI powered group project companion for Students",
    students: [
      { rollNo: 30, name: "Bipin Swarnkar" },
      { rollNo: 33, name: "Tanuja Anilkumar" },
      { rollNo: 34, name: "Teerth Lalwani" },
    ],
  },
  {
    groupId: "C7",
    guide: "Ms. Loukik S",
    title:
      "AI-Enabled smart tourism platform for real time safety intelligence",
    students: [
      { rollNo: 23, name: "Ojas Singwi" },
      { rollNo: 24, name: "Sumit Sonkamble" },
      { rollNo: 31, name: "Chinmay Dilip Takke" },
    ],
  },
  {
    groupId: "C8",
    guide: "Mrs. Veena Kulkarni",
    title: "Smart Bed Allocation and Hospital Resource Management System",
    students: [
      { rollNo: 27, name: "Sunay Bhargava" },
      { rollNo: 69, name: "Sahil Rajesh Singh" },
      { rollNo: 70, name: "Sangram Supalkar" },
    ],
  },
  {
    groupId: "C9",
    guide: "Dr. R. R. Sedamkar/ Co guide: Ms. Siddhi Ambre",
    title: "AI driven Intrusion detection system for smart city",
    students: [
      { rollNo: 25, name: "Soor Parmar" },
      { rollNo: 37, name: "Adarsh Tiwari" },
      { rollNo: 40, name: "tanushree tiwari" },
    ],
  },
  {
    groupId: "C10",
    guide: "Mrs.Veena Kulkarni",
    title:
      "Adaptive Secure Communication System for Reliable Networkless Connectivity",
    students: [
      { rollNo: 4, name: "Abhijeet Dilip Shelke" },
      { rollNo: 14, name: "Om Alok Singh" },
      { rollNo: 42, name: "Vikas Tiwari" },
    ],
  },
  {
    groupId: "C11",
    guide: "Dr.Rashmi Thakur",
    title: "Intelligent Research Companion using GenAI",
    students: [
      { rollNo: 2, name: "Ankit Sharma" },
      { rollNo: 17, name: "Ranjan Pramod Singh" },
      { rollNo: 22, name: "Utsav Singh" },
    ],
  },
  {
    groupId: "C12",
    guide: "Dr.Vaishali Nirgude",
    title: "Health Management & Tracking Web App",
    students: [
      { rollNo: 67, name: "Zayed Shaikh" },
      { rollNo: 68, name: "Karan Sharma" },
      { rollNo: 44, name: "Nitesh Varma" },
    ],
  },
  {
    groupId: "C13",
    guide: "Ms. Abhilasha Patil",
    title: "Online learning platform with personalized path",
    students: [
      { rollNo: 28, name: "Sakshi Surve" },
      { rollNo: 39, name: "Aastha Amardeep Tiwari" },
      { rollNo: 6, name: "Dhruv Shinde" },
    ],
  },
  {
    groupId: "C14",
    guide: "Mr. Swapnil Bhagat",
    title: "Live Bus Tracking app",
    students: [
      { rollNo: 35, name: "Kartik Thagellapally" },
      { rollNo: 15, name: "Parmanand Singh" },
    ],
  },
  {
    groupId: "C15",
    guide: "Ms. Tarunima Mukherjee",
    title: "Automated Social media comment analyzer for Opinion Mining",
    students: [
      { rollNo: 50, name: "Abhishek Yadav" },
      { rollNo: 52, name: "Ankit Yadav" },
      { rollNo: 62, name: "Vishal Yadav" },
    ],
  },
  {
    groupId: "C16",
    guide: "Ms. Tanmayi N",
    title:
      "An autonomous framework for self healing cloud native infrastructure",
    students: [
      { rollNo: 38, name: "Arpit Tiwari" },
      { rollNo: 36, name: "Aadarsh Tiwari" },
      { rollNo: 60, name: "Shubh Yadav" },
    ],
  },
  {
    groupId: "C17",
    guide: "Mrs. Vinitta Sunish",
    title: "AI-Driven Carbon Footprint Tracker and Reduction Assistant",
    students: [
      { rollNo: 29, name: "Sanskar Suryawanshi" },
      { rollNo: 13, name: "Manav Singh" },
      { rollNo: 11, name: "Kesar Singh" },
    ],
  },
  {
    groupId: "C18",
    guide: "Ms. Tanmayi N",
    title: "AI powered interview cheating detection system",
    students: [
      { rollNo: 10, name: "Ashmit Singh" },
      { rollNo: 21, name: "Sumit Singh" },
      { rollNo: 19, name: "Shivam Singh" },
    ],
  },
  {
    groupId: "C19",
    guide: "Mrs. Vinitta Sunish",
    title:
      "An AI-powered virtual Chartered accountant for automated financial analysis",
    students: [
      { rollNo: 58, name: "Ritesh Yadav" },
      { rollNo: 55, name: "Rajkumar Yadav" },
      { rollNo: 56, name: "Ramkisan Yadav" },
    ],
  },
  {
    groupId: "C20",
    guide: "Dr. R. R. Sedamkar/ Co guide: Ms. Siddhi Ambre",
    title:
      "Blockchain Enabled Intelligent Inventory management System for Retail Chains",
    students: [
      { rollNo: 51, name: "Ankit Yadav" },
      { rollNo: 57, name: "Reetika Yadav" },
      { rollNo: 18, name: "Rishabh Singh" },
    ],
  },
  {
    groupId: "C21",
    guide: "Ms. Pratiksha D",
    title: "Fake News Detection Using Hybrid ML Models",
    students: [
      { rollNo: 47, name: "Manthan Vishwakarma" },
      { rollNo: 59, name: "Rupesh Yadav" },
      { rollNo: 64, name: "Yashwanth Pedapolu" },
    ],
  },
  {
    groupId: "C22",
    guide: "Ms. Drashti S",
    title: "Dynamic Route Rationalization using real time data",
    students: [
      { rollNo: 32, name: "Tanmay Shinde" },
      { rollNo: 5, name: "Krish Shetty" },
      { rollNo: 48, name: "Parth Vishwakarma" },
    ],
  },
  {
    groupId: "C23",
    guide: "Ms. Drashti S",
    title:
      "A modular architecture for reducing and monitoring computational Carbon footprint of AI",
    students: [
      { rollNo: 12, name: "Lakshyajeet Singh" },
      { rollNo: 1, name: "Seher Sharik" },
      { rollNo: 8, name: "Aditi Singh" },
    ],
  },
  {
    groupId: "C24",
    guide: "Mrs.Lydia Suganya",
    title:
      "DevSpace: A domain-aware Intelligent social platform for developer centric knowledge sharing",
    students: [
      { rollNo: 53, name: "Anushka Yadav" },
      { rollNo: 63, name: "Vishal Yadav" },
      { rollNo: 65, name: "Jaitej Singh" },
    ],
  },
];

// ========== COLORS & UTILS ==========
const DONUT_COLORS = [
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#94a3b8",
];
const AREA_GRADIENT = [
  "#6366f1",
  "#22d3ee",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
  "#ec4899",
  "#94a3b8",
];

const TECH_FOCUS_CATEGORIES: Record<string, string[]> = {
  "AI & Machine Learning": [
    "ai",
    "ml",
    "machine learning",
    "deep learning",
    "nlp",
    "computer vision",
    "predictive",
    "intelligent",
    "genai",
  ],
  "IoT & Smart Systems": [
    "iot",
    "smart",
    "drone",
    "embedded",
    "microcontroller",
    "stm32",
    "esp8266",
    "hardware",
    "sensor",
  ],
  "Security & Crypto": [
    "blockchain",
    "cyber",
    "security",
    "fuzzer",
    "crypto",
    "secure",
    "fraud",
    "forgery",
    "threat",
  ],
  "Data & Analytics": [
    "data",
    "analytics",
    "tracker",
    "tracking",
    "analyzer",
    "monitoring",
    "detection",
  ],
  "Platforms & Web Apps": [
    "app",
    "platform",
    "web",
    "portal",
    "dashboard",
    "system",
    "management",
  ],
};

const isValidString = (val: any) =>
  typeof val === "string" &&
  val.trim() !== "" &&
  val.toLowerCase() !== "undefined" &&
  val.toLowerCase() !== "null" &&
  val.toLowerCase() !== "n/a";

// Utility to limit chart data to Top N and group the rest
const getTopNData = (dataMap: Record<string, number>, n: number = 7) => {
  const sorted = Object.entries(dataMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, fullName: name }));

  if (sorted.length <= n) return sorted;

  const top = sorted.slice(0, n);
  const othersCount = sorted
    .slice(n)
    .reduce((sum, item) => sum + item.count, 0);

  if (othersCount > 0) {
    top.push({ name: "Others", count: othersCount, fullName: "Others" });
  }
  return top;
};

type FilterType = "sdg" | "class" | "category" | "techFocus" | "department";
type SelectedFilters = Record<FilterType, string[]>;
type FilterOption = { value: string; count: number };
type FilterOptionMap = Record<FilterType, FilterOption[]>;

const FILTER_LABELS: Record<FilterType, string> = {
  sdg: "SDG",
  class: "Class",
  category: "Category",
  techFocus: "Tech Focus",
  department: "Department",
};

const ALL_FILTER_TYPES: FilterType[] = [
  "department",
  "sdg",
  "class",
  "category",
  "techFocus",
];

const createEmptyFilters = (): SelectedFilters => ({
  sdg: [],
  class: [],
  category: [],
  techFocus: [],
  department: [],
});

const getTechFocusCategory = (project: any) => {
  const titleLower = project.title?.toLowerCase() || "";
  let matchedCategory = "Platforms & Web Apps";
  for (const [cat, keywords] of Object.entries(TECH_FOCUS_CATEGORIES)) {
    if (keywords.some((kw) => titleLower.includes(kw))) {
      matchedCategory = cat;
      break;
    }
  }
  return matchedCategory;
};

// ========== COMPONENT ==========
export default function AnalyticsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "be" | "rbl">(
    "overview",
  );

  // Directly drive UI from selectedFilters (Real-time updates)
  const [selectedFilters, setSelectedFilters] =
    useState<SelectedFilters>(createEmptyFilters());

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<FilterType, boolean>
  >({
    sdg: false,
    class: false,
    category: false,
    techFocus: false,
    department: false,
  });

  const [activeDeptView, setActiveDeptView] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFilters(createEmptyFilters());
    setSearchQuery("");
    setActiveDeptView(null);
  }, [activeTab]);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterPopoverRef.current?.contains(target)) return;
      if (filterButtonRef.current?.contains(target)) return;
      setShowFilterPanel(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFilterPanel(false);
        return;
      }
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilterPanel]);

  const toggleFilter = (type: FilterType, value: string) => {
    if (value === "Others") return;
    setSelectedFilters((prev) => {
      const hasValue = prev[type].includes(value);
      return {
        ...prev,
        [type]: hasValue
          ? prev[type].filter((v) => v !== value)
          : [...prev[type], value],
      };
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters(createEmptyFilters());
  };

  const toggleSection = (type: FilterType) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const hasActiveFilters = useMemo(
    () => Object.values(selectedFilters).some((values) => values.length > 0),
    [selectedFilters],
  );

  const selectedFilterCount = useMemo(
    () =>
      Object.values(selectedFilters).reduce(
        (sum, values) => sum + values.length,
        0,
      ),
    [selectedFilters],
  );

  const isDimmed = (type: FilterType, value: string) =>
    selectedFilters[type].length > 0 && !selectedFilters[type].includes(value);

  const filterOptions = useMemo<FilterOptionMap>(() => {
    const beBase = activeTab === "rbl" ? [] : beProjects;
    const rblBase = activeTab === "be" ? [] : rblGroups;
    const combined = [...beBase, ...rblBase];

    const buildCountOptions = (values: string[]) => {
      const counts: Record<string, number> = {};
      values.forEach((v) => {
        if (isValidString(v)) counts[v] = (counts[v] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    };

    const departments = buildCountOptions(
      combined.map((p) => p.department || "Unspecified"),
    );

    const sdgs = buildCountOptions(
      beBase.map((p) => {
        const num = parseInt(p.sdg);
        return !isNaN(num) && num >= 1 && num <= 17 ? String(num) : "";
      }),
    ).sort((a, b) => Number(a.value) - Number(b.value));

    const classOptions =
      activeTab === "be"
        ? ["BE-A", "BE-B", "BE-C"]
        : activeTab === "rbl"
          ? ["TE-A", "TE-B", "TE-C"]
          : ["BE-A", "BE-B", "BE-C", "TE-A", "TE-B", "TE-C"];
    const classCounts: Record<string, number> = Object.fromEntries(
      classOptions.map((className) => {
        const [stream, section] = className.split("-");
        const base = stream === "BE" ? beBase : rblBase;
        return [
          className,
          base.filter((p) => p.groupId?.startsWith(section)).length,
        ];
      }),
    );
    const classes = classOptions.map((value) => ({
      value,
      count: classCounts[value] || 0,
    }));

    const categories = buildCountOptions(beBase.map((p) => p.category));
    const techFocus = buildCountOptions(
      combined.map((p) => getTechFocusCategory(p)),
    );

    return {
      department: departments,
      sdg: sdgs,
      class: classes,
      category: categories,
      techFocus,
    };
  }, [activeTab]);

  const { filteredBE, filteredRBL, displayProjects } = useMemo(() => {
    const isMatch = (p: any, stream: "BE" | "TE") => {
      const matchesDepartment =
        selectedFilters.department.length === 0 ||
        selectedFilters.department.includes(p.department || "Unspecified");

      const matchesSdg =
        selectedFilters.sdg.length === 0 ||
        selectedFilters.sdg.includes(String(p.sdg));
      const matchesClass =
        selectedFilters.class.length === 0 ||
        selectedFilters.class.some((classValue) => {
          const [targetStream, section] = classValue.split("-");
          return targetStream === stream && p.groupId?.startsWith(section);
        });
      const matchesCategory =
        selectedFilters.category.length === 0 ||
        selectedFilters.category.includes(p.category);
      const matchesTechFocus =
        selectedFilters.techFocus.length === 0 ||
        selectedFilters.techFocus.includes(getTechFocusCategory(p));

      let passesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        passesSearch =
          p.title?.toLowerCase().includes(q) ||
          p.guide?.toLowerCase().includes(q) ||
          p.groupId?.toLowerCase().includes(q) ||
          p.students?.some((s: any) => s.name.toLowerCase().includes(q));
      }
      return (
        matchesDepartment &&
        matchesSdg &&
        matchesClass &&
        matchesCategory &&
        matchesTechFocus &&
        passesSearch
      );
    };
    const be =
      activeTab === "rbl" ? [] : beProjects.filter((p) => isMatch(p, "BE"));
    const rbl =
      activeTab === "be" ? [] : rblGroups.filter((p) => isMatch(p, "TE"));
    return {
      filteredBE: be,
      filteredRBL: rbl,
      displayProjects: [...be, ...rbl],
    };
  }, [selectedFilters, searchQuery, activeTab]);

  const metrics = useMemo(() => {
    const totalBE = filteredBE.length;
    const totalRBL = filteredRBL.length;
    const totalProjects = totalBE + totalRBL;
    const beStudents = filteredBE.reduce((a, p) => a + p.students.length, 0);
    const rblStudents = filteredRBL.reduce((a, p) => a + p.students.length, 0);
    const totalStudents = beStudents + rblStudents;
    const totalGuides = new Set([
      ...filteredBE.map((p) => p.guide),
      ...filteredRBL.map((p) => p.guide),
    ]).size;

    const domainCounts: Record<string, number> = {};
    filteredBE.forEach((p) => {
      if (isValidString(p.domain))
        domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;
    });
    const domainData = getTopNData(domainCounts, 7);

    const sdgCounts: Record<
      string,
      { sdg: number; title: string; count: number }
    > = {};
    filteredBE.forEach((p) => {
      const num = parseInt(p.sdg);
      if (!isNaN(num) && num >= 1 && num <= 17) {
        if (!sdgCounts[num])
          sdgCounts[num] = {
            sdg: num,
            title: p.sdgTitle || `SDG ${num}`,
            count: 0,
          };
        sdgCounts[num].count++;
      }
    });
    const sdgData = Object.values(sdgCounts).sort((a, b) => b.count - a.count);

    const techFocusCounts: Record<string, number> = Object.keys(
      TECH_FOCUS_CATEGORIES,
    ).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    [...filteredBE, ...filteredRBL].forEach(
      (p) => techFocusCounts[getTechFocusCategory(p)]++,
    );
    const techFocusData = Object.entries(techFocusCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const classData = [
      {
        name: "BE-A",
        value: filteredBE.filter((p) => p.groupId.startsWith("A")).length,
      },
      {
        name: "BE-B",
        value: filteredBE.filter((p) => p.groupId.startsWith("B")).length,
      },
      {
        name: "BE-C",
        value: filteredBE.filter((p) => p.groupId.startsWith("C")).length,
      },
      {
        name: "TE-A",
        value: filteredRBL.filter((p) => p.groupId.startsWith("A")).length,
      },
      {
        name: "TE-B",
        value: filteredRBL.filter((p) => p.groupId.startsWith("B")).length,
      },
      {
        name: "TE-C",
        value: filteredRBL.filter((p) => p.groupId.startsWith("C")).length,
      },
    ];

    const categoryCounts: Record<string, number> = {};
    const applicationCounts: Record<string, number> = {};
    filteredBE.forEach((p) => {
      if (isValidString(p.category))
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      if (isValidString(p.projectApplication))
        applicationCounts[p.projectApplication] =
          (applicationCounts[p.projectApplication] || 0) + 1;
    });

    const categoryData = getTopNData(categoryCounts, 7);
    const applicationData = getTopNData(applicationCounts, 8);

    return {
      totalProjects,
      totalBE,
      totalRBL,
      totalStudents,
      beStudents,
      rblStudents,
      totalGuides,
      domainData,
      sdgData,
      techFocusData,
      classData,
      categoryData,
      applicationData,
      rawDomainCount: Object.keys(domainCounts).length,
    };
  }, [filteredBE, filteredRBL]);

  const kpiCards = [
    {
      label: "Total Projects",
      value: metrics.totalProjects,
      sub:
        activeTab === "overview"
          ? `${metrics.totalBE} Major + ${metrics.totalRBL} RBL`
          : activeTab === "be"
            ? "BE Major Projects"
            : "TE RBL Projects",
      icon: FolderKanban,
      color: "from-indigo-500 to-indigo-600",
      change: "Active",
      up: true,
    },
    {
      label: "Total Students",
      value: metrics.totalStudents,
      sub:
        activeTab === "overview"
          ? `${metrics.beStudents} BE + ${metrics.rblStudents} TE`
          : "Enrolled students",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      change: `Avg ${(metrics.totalStudents / Math.max(1, metrics.totalProjects)).toFixed(1)}/proj`,
      up: true,
    },
    {
      label: "Faculty Guides",
      value: metrics.totalGuides,
      sub: "Assisting active projects",
      icon: GraduationCap,
      color: "from-emerald-500 to-emerald-600",
      change: "Mentorship",
      up: true,
    },
    {
      label: activeTab === "rbl" ? "Tech Focus Areas" : "Unique Domains",
      value:
        activeTab === "rbl"
          ? metrics.techFocusData.length
          : metrics.rawDomainCount,
      sub: activeTab === "rbl" ? "Identified from titles" : "BE Major Projects",
      icon: Lightbulb,
      color: "from-amber-500 to-amber-600",
      change:
        activeTab === "rbl"
          ? "Innovation focus"
          : `${metrics.sdgData.length} Valid SDGs`,
      up: true,
    },
  ];

  const CustomTooltipStyle =
    "bg-neutral-900 dark:bg-black border border-neutral-800 rounded-lg px-4 py-3 shadow-2xl text-white text-xs max-w-[240px] whitespace-normal font-medium tracking-wide";

  const availableDepts =
    activeTab === "be" ? ["BE"] : activeTab === "rbl" ? ["TE"] : ["BE", "TE"];
  const isShowingDepartments = availableDepts.length > 1 && !activeDeptView;

  const displayData = isShowingDepartments
    ? availableDepts.map((dept) => ({
        name: dept,
        value: metrics.classData
          .filter((c) => c.name.startsWith(dept))
          .reduce((sum, c) => sum + c.value, 0),
        isDept: true,
      }))
    : metrics.classData
        .filter((c) => c.name.startsWith(activeDeptView || availableDepts[0]))
        .map((c) => ({ ...c, isDept: false }));

  return (
    <div className="relative w-full min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] overflow-hidden font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; border-radius: 10px; }
        `,
        }}
      />

      <div className="fixed inset-0 -z-20 dark:bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="fixed top-0 left-0 right-0 z-50 h-24 pointer-events-none">
        <div className="relative w-full max-w-7xl mx-auto h-full px-6">
          <div className="pointer-events-auto">
            <FloatingPillNavbar />
          </div>
        </div>
      </div>

      <ThemeToggle />

      <div className="relative w-full max-w-7xl mx-auto px-4 md:px-6 pb-12 pt-32 space-y-8 text-neutral-800 dark:text-neutral-100">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-neutral-900 dark:text-white uppercase">
            Project Analytics
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl text-sm font-medium tracking-wide">
            Intelligent aggregation of Major Projects (BE) and RBL Projects (TE)
            mapping sustainable metrics and technical distributions.
          </p>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800/50">
            <div className="flex flex-wrap gap-2">
              {(["overview", "be", "rbl"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${activeTab === tab ? "bg-neutral-900 dark:bg-white text-white dark:text-black border-transparent" : "bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 border-neutral-300 dark:border-neutral-800"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative">
                <button
                  ref={filterButtonRef}
                  onClick={() => setShowFilterPanel((prev) => !prev)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-transparent border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" /> Filters (
                  {selectedFilterCount})
                </button>

                {showFilterPanel && (
                  <div
                    ref={filterPopoverRef}
                    className="absolute top-full mt-2 left-0 md:right-0 md:left-auto w-full md:w-80 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-xl z-50 p-4"
                  >
                    <div className="space-y-4">
                      {(ALL_FILTER_TYPES as FilterType[]).map((type) => (
                        <div
                          key={type}
                          className="border-b border-neutral-200 dark:border-neutral-800 pb-3 last:border-b-0"
                        >
                          <button
                            onClick={() => toggleSection(type)}
                            className="flex items-center justify-between w-full text-sm font-semibold text-neutral-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            <span>{FILTER_LABELS[type]}</span>
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                expandedSections[type] ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {expandedSections[type] && (
                            <div className="mt-2 space-y-2">
                              {filterOptions[type]?.map((option) => {
                                const isSelected = selectedFilters[
                                  type
                                ].includes(option.value);

                                return (
                                  <label
                                    key={option.value}
                                    className="flex items-center gap-2 cursor-pointer text-xs p-1 rounded transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() =>
                                        toggleFilter(type, option.value)
                                      }
                                      className="w-3 h-3 rounded cursor-pointer accent-indigo-500"
                                    />
                                    <span className="text-neutral-700 dark:text-neutral-300">
                                      {option.value}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-auto">
                                      ({option.count})
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                      <button
                        onClick={clearAllFilters}
                        className="flex-1 px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setShowFilterPanel(false)}
                        className="flex-1 px-3 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
                >
                  Clear <X className="w-3 h-3" />
                </button>
              )}

              <div className="relative w-full md:w-64 lg:w-72 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search title, guide, student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-transparent border border-neutral-300 dark:border-neutral-800 rounded-md text-sm text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {kpiCards.map((card, i) => (
            <div
              key={card.label}
              className="relative p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    {card.label}
                  </p>
                  <p className="text-3xl font-black tracking-tighter text-neutral-900 dark:text-white">
                    {card.value}
                  </p>
                  <p className="text-[11px] text-neutral-500">{card.sub}</p>
                </div>
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${card.color} text-white`}
                >
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {activeTab !== "rbl" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                    Domain Distribution
                  </h3>
                </div>
                <Target className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer
                  width="100%"
                  height={200}
                  className="sm:w-1/2"
                >
                  <PieChart>
                    <Pie
                      data={metrics.domainData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="count"
                      stroke="none"
                    >
                      {metrics.domainData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                          opacity={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className={CustomTooltipStyle}>
                            <p className="font-bold text-white mb-1">
                              {d.name}
                            </p>
                            <p className="text-neutral-400">
                              {d.count} Projects
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full sm:w-1/2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                  {metrics.domainData.map((d, i) => (
                    <div
                      key={d.fullName}
                      className="flex items-center gap-2 py-1"
                    >
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                      <span
                        className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 truncate flex-1"
                        title={d.fullName}
                      >
                        {d.name}
                      </span>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {d.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                    SDG Alignment
                  </h3>
                </div>
                <Award className="w-4 h-4 text-neutral-400" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                {metrics.sdgData.length > 0 ? (
                  <BarChart data={metrics.sdgData} barSize={16}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(128,128,128,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="sdg"
                      tick={{ fontSize: 10, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(128,128,128,0.05)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className={CustomTooltipStyle}>
                            <p className="font-bold text-white">SDG {d.sdg}</p>
                            <p className="text-neutral-500 mt-1">{d.title}</p>
                            <p className="mt-2 font-bold">{d.count} Projects</p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(d) => toggleFilter("sdg", String(d.sdg))}
                      className="cursor-pointer"
                    >
                      {metrics.sdgData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                          opacity={isDimmed("sdg", String(d.sdg)) ? 0.3 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                    No Valid SDGs mapped.
                  </div>
                )}
              </ResponsiveContainer>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
          >
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                Innovation Focus
              </h3>
              <Lightbulb className="w-4 h-4 text-neutral-400" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={metrics.techFocusData}
                layout="vertical"
                barSize={12}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(128,128,128,0.1)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#737373" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 10, fill: "#737373", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(128,128,128,0.05)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className={CustomTooltipStyle}>
                        <p className="font-bold">{d.name}</p>
                        <p className="mt-1 text-neutral-400">
                          {d.count} Projects
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  onClick={(d) => toggleFilter("techFocus", d.name)}
                  className="cursor-pointer"
                >
                  {metrics.techFocusData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                      opacity={isDimmed("techFocus", d.name) ? 0.3 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
          >
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                {isShowingDepartments
                  ? "Department Analytics"
                  : `${activeDeptView || availableDepts[0]} Divisions`}
              </h3>
              {!isShowingDepartments && availableDepts.length > 1 && (
                <button
                  onClick={() => setActiveDeptView(null)}
                  className="text-[10px] uppercase font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  &larr; Back to Depts
                </button>
              )}
            </div>
            <div className="space-y-4 pt-2">
              {displayData.map((item, i) => {
                const maxVal = Math.max(...displayData.map((c) => c.value));
                const pct = maxVal === 0 ? 0 : (item.value / maxVal) * 100;

                let isFaded = false;
                if (item.isDept) {
                  isFaded =
                    selectedFilters.class.length > 0 &&
                    !selectedFilters.class.some((c) => c.startsWith(item.name));
                } else {
                  isFaded = isDimmed("class", item.name);
                }

                return (
                  <div
                    key={item.name}
                    className={`space-y-1.5 cursor-pointer transition-opacity ${
                      isFaded ? "opacity-30" : "hover:opacity-80"
                    }`}
                    onClick={() => {
                      if (item.isDept) {
                        setActiveDeptView(item.name);
                      } else {
                        toggleFilter("class", item.name);
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {item.isDept ? `${item.name} Department` : item.name}
                      </span>
                      <span className="text-xs font-black text-neutral-900 dark:text-white">
                        {item.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor:
                            DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {activeTab !== "rbl" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                  Project Categories
                </h3>
                <Layers className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer
                  width="100%"
                  height={200}
                  className="sm:w-1/2"
                >
                  <PieChart>
                    <Pie
                      data={metrics.categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="count"
                      stroke="none"
                      onClick={(d) =>
                        d.name !== "Others" &&
                        toggleFilter("category", d.fullName)
                      }
                      className="cursor-pointer"
                    >
                      {metrics.categoryData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={AREA_GRADIENT[i % AREA_GRADIENT.length]}
                          opacity={isDimmed("category", d.fullName) ? 0.2 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className={CustomTooltipStyle}>
                            <p className="font-bold text-white mb-1">
                              {d.name}
                            </p>
                            <p className="text-neutral-400">
                              {d.count} Projects
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full sm:w-1/2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                  {metrics.categoryData.map((d, i) => (
                    <div
                      key={d.fullName}
                      className="flex items-center gap-2 py-1"
                    >
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            AREA_GRADIENT[i % AREA_GRADIENT.length],
                        }}
                      />
                      <span
                        className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 truncate flex-1"
                        title={d.fullName}
                      >
                        {d.name}
                      </span>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {d.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                  Application Target
                </h3>
                <Briefcase className="w-4 h-4 text-neutral-400" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={metrics.applicationData}
                  layout="vertical"
                  barSize={12}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(128,128,128,0.1)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(128,128,128,0.05)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className={CustomTooltipStyle}>
                          <p className="font-bold">{d.name}</p>
                          <p className="mt-1 text-neutral-400">
                            {d.count} Projects
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {metrics.applicationData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                        opacity={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        )}

        {(hasActiveFilters || searchQuery) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] p-6"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-100 dark:border-neutral-800/50">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                  {searchQuery
                    ? `Searching: "${searchQuery}"`
                    : "Filtered Results"}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Found {displayProjects.length} matches
                </p>
              </div>
              <button
                onClick={() => {
                  clearAllFilters();
                  setSearchQuery("");
                }}
                className="px-4 py-2 text-xs font-bold uppercase bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-md transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProjects.map((proj, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#1a1a1a] flex flex-col group hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black tracking-wider px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300">
                      GRP {proj.groupId}
                    </span>
                    {isValidString(proj.department) && (
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase">
                        {proj.department}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white line-clamp-2 mb-4 leading-snug group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {proj.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800/80">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span className="truncate">{proj.guide}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
