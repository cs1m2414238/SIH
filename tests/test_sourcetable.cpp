#include "SourcetableParser.h"
#include <iostream>
#include <cassert>
#include <vector>

void testBasicSourcetableParsing() {
    SourcetableParser parser;
    std::string mockResponse =
        "SOURCETABLE 200 OK\r\n"
        "Server: NTRIP Caster 2.0\r\n"
        "Content-Type: text/plain\r\n"
        "\r\n"
        "STR;BASE01;SIH1520 Base 01;RTCM 3.3;1005(1),1077(1);2;GPS+GLO;SIH;IND;26.45;80.33;0;0;sih-gen;none;B;N;9600;\r\n"
        "STR;BASE02;SIH1520 Base 02;RTCM 3.3;1005(1),1087(1);2;GPS+GAL;SIH;IND;28.61;77.20;0;0;sih-gen;none;B;N;9600;\r\n"
        "ENDSOURCETABLE\r\n";

    bool ok = parser.parse(mockResponse);
    assert(ok && "Parser should succeed with valid STR records");

    auto mountpoints = parser.getMountpoints();
    assert(mountpoints.size() == 2 && "Should extract exactly 2 mountpoints");
    assert(mountpoints[0] == "/BASE01" && "First mountpoint should be /BASE01");
    assert(mountpoints[1] == "/BASE02" && "Second mountpoint should be /BASE02");

    std::string selected;
    bool foundPreferred = parser.selectMountpoint("/BASE01", selected);
    assert(foundPreferred && selected == "/BASE01" && "Should select preferred /BASE01");

    bool foundBase2 = parser.selectMountpoint("/BASE02", selected);
    assert(foundBase2 && selected == "/BASE02" && "Should select /BASE02");

    bool fallback = parser.selectMountpoint("/NON_EXISTENT", selected);
    assert(fallback && selected == "/BASE01" && "Should fallback to first available (/BASE01)");

    std::cout << "[PASS] testBasicSourcetableParsing" << std::endl;
}

void testEmptyAndMalformedSourcetable() {
    SourcetableParser parser;
    std::string empty = "";
    assert(!parser.parse(empty) && "Empty sourcetable should fail");

    std::string noStr = "CAS;127.0.0.1;2101;SIH Caster;...;0\r\nENDSOURCETABLE\r\n";
    assert(!parser.parse(noStr) && "Sourcetable without STR should return false");

    std::string selected;
    assert(!parser.selectMountpoint("/BASE01", selected) && "selectMountpoint should fail when no records exist");

    std::cout << "[PASS] testEmptyAndMalformedSourcetable" << std::endl;
}

int main() {
    std::cout << "Running SourcetableParser Tests..." << std::endl;
    testBasicSourcetableParsing();
    testEmptyAndMalformedSourcetable();
    std::cout << "All SourcetableParser tests passed successfully!" << std::endl;
    return 0;
}
