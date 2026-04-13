package com.example.intrusion.dto;

public class MeanClassProbsDto {
    private double no_threat;
    private double fence;
    private double manipulation;

    public double getNo_threat() {
        return no_threat;
    }

    public void setNo_threat(double no_threat) {
        this.no_threat = no_threat;
    }

    public double getFence() {
        return fence;
    }

    public void setFence(double fence) {
        this.fence = fence;
    }

    public double getManipulation() {
        return manipulation;
    }

    public void setManipulation(double manipulation) {
        this.manipulation = manipulation;
    }
}