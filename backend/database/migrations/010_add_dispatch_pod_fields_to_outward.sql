-- Migration 010: Add Courier, AWB, Transport Mode, Date of POD, and POD Remarks to OutwardHeader
ALTER TABLE "OutwardHeader" ADD COLUMN "CourierCompany" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "OutwardHeader" ADD COLUMN "AwbNo" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "OutwardHeader" ADD COLUMN "TransportMode" VARCHAR(50) DEFAULT NULL;
ALTER TABLE "OutwardHeader" ADD COLUMN "DateOfPod" VARCHAR(20) DEFAULT NULL;
ALTER TABLE "OutwardHeader" ADD COLUMN "PodRemarks" VARCHAR(255) DEFAULT NULL;
