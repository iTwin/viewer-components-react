/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export default `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
	<edmx:DataServices>
		<Schema Namespace="Insights_and_Reporting_Extractor" xmlns="http://docs.oasis-open.org/odata/ns/edm">
			<EntityType Name="mapping0">
				<Property Name="ECInstanceId" Type="Edm.String"/>
				<Property Name="ECClassId" Type="Edm.String"/>
				<Property Name="UserLabel" Type="Edm.String"/>
				<Property Name="BBoxLow" Type="Edm.String"/>
				<Property Name="BBoxHigh" Type="Edm.String"/>
				<Property Name="Area" Type="Edm.Double"/>
			</EntityType>
			<EntityType Name="Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad">
				<Property Name="ECInstanceId" Type="Edm.String"/>
				<Property Name="ECClassId" Type="Edm.String"/>
				<Property Name="UserLabel" Type="Edm.String"/>
				<Property Name="BBoxLow" Type="Edm.String"/>
				<Property Name="BBoxHigh" Type="Edm.String"/>
				<Property Name="Heigth" Type="Edm.Double"/>
			</EntityType>
			<EntityType Name="Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad">
				<Property Name="ECInstanceId" Type="Edm.String"/>
				<Property Name="ECClassId" Type="Edm.String"/>
				<Property Name="UserLabel" Type="Edm.String"/>
				<Property Name="BBoxLow" Type="Edm.String"/>
				<Property Name="BBoxHigh" Type="Edm.String"/>
				<Property Name="Length" Type="Edm.Double"/>
			</EntityType>
			<EntityType Name="Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad">
				<Property Name="ECInstanceId" Type="Edm.String"/>
				<Property Name="ECClassId" Type="Edm.String"/>
				<Property Name="UserLabel" Type="Edm.String"/>
				<Property Name="BBoxLow" Type="Edm.String"/>
				<Property Name="BBoxHigh" Type="Edm.String"/>
				<Property Name="volume" Type="Edm.Double"/>
			</EntityType>
		</Schema>
		<Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
			<EntityContainer Name="Container">
				<EntitySet Name="mapping0" EntityType="Insights_and_Reporting_Extractor.mapping0"/>
				<EntitySet Name="Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad" EntityType="Insights_and_Reporting_Extractor.Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad"/>
				<EntitySet Name="Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad" EntityType="Insights_and_Reporting_Extractor.Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad"/>
				<EntitySet Name="Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad" EntityType="Insights_and_Reporting_Extractor.Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad"/>
			</EntityContainer>
		</Schema>
	</edmx:DataServices>
</edmx:Edmx>`;
